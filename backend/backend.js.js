// ** IMPORT STATEMENTS **
// import {EventRegister} from 'react-native-event-listeners';
const {EventRegister} = require('react-native-event-listeners');
import * as mediasoupClient from 'mediasoup-client';
import {registerGlobals} from 'react-native-webrtc';
import axios from 'axios';
import * as Sentry from '@sentry/react-native';
import SocketIOClient from 'socket.io-client';
import {SOCKET_SERVER, HEART_BEAT_URL} from 'source/env.json';
import {store} from './store';

// ** BRIGOSHA MEDIA TYPES **
const MEDIA_TYPE = {
  audio: 'audioType',
  video: 'videoType',
  screen: 'screenType',
};

const _EVENTS = {
  exitRoom: 'exitRoom',
  openRoom: 'openRoom',
  startVideo: 'startVideo',
  stopVideo: 'stopVideo',
  startAudio: 'startAudio',
  stopAudio: 'stopAudio',
  startScreen: 'startScreen',
  stopScreen: 'stopScreen',
};
let producer;
let healthTimer;
let socketHealthTimer;
let boardOpenTimer;

export default class BrigoshaMedia {
  // ** CONSTRUCTOR **
  constructor() {
    if (BrigoshaMedia._instance) {
      return BrigoshaMedia._instance;
    }
    BrigoshaMedia._instance = this;

    this.user_id = null;
    this.room_id = null;
    this.user = null;
    this.userName = '';
    this.platform = null;
    this.conferenceId = null;
    this.isTeacher = null;
    this.isClassJoined = false;
    this.classMode = null;

    this.producerTransport = null;
    this.consumerTransport = null;
    this.device = null;
    this.activeSpeaker = null;
    this.offline = false;
    this.userList = [];
    this.remoteMedia = [];
    this.localMedia = null;
    this.socket = null;
    this.baseUrl = '';
    this.pingPongStatus = false;

    this.consumers = new Map();
    this.producers = new Map();
    this.producerLabel = new Map();

    this._useDataChannel = true;
    this._chatDataProducer = null;
    this._boardDataProducer = null;
    this._dataConsumers = new Map();
    this._dataProducers = new Map();

    this._isOpen = false;
    this.isCanvasOpen = false;
    this.executeJoinRcv = false;
    this.eventListeners = new Map();
    Object.keys(_EVENTS).forEach(evt => {
      this.eventListeners.set(evt, []);
    });
    this._isOpen = true;
  }

  init(user_id, room_id, userName, user, isTeacher, platform, confId, mode) {
    this.user_id = parseInt(user_id, 10);
    this.room_id = room_id;
    this.user = user;
    this.userName = userName;
    this.platform = platform;
    this.conferenceId = confId;
    this.isTeacher = isTeacher;
    this.classMode = mode;
    this.healthCheckClient = SocketIOClient.connect(HEART_BEAT_URL);
    this.initSocketIO(true);
  }

  updateClassJoinStatus(status) {
    this.isClassJoined = status;
  }

  initSocketIO(isJoinRcv) {
    console.log('initSocketIO', isJoinRcv, this.healthCheckClient.connected);
    this.healthCheckClient.on('connect', () => {
      console.log('health check connect');
      // EventRegister.emit('socketReconnected');
      this.initSockets(isJoinRcv, this.healthCheckClient.id);
      this.healthCheckClient.emit('register', {
        userId: this.user_id,
        roomId: this.room_id,
      });
    });

    this.healthCheckClient.on('error', error => {
      // Do nothing
      console.log('healthCheckClient error', error);
    });
    this.healthCheckClient.on('disconnect', reason => {
      // Do nothing
      console.log('healthCheckClient disconnected', reason);
      if (!this.isClassJoined) {
        return;
      }
      // Health check will try to reconnect
      const self = this;
      clearTimeout(healthTimer);
      healthTimer = setTimeout(() => {
        if (!self.healthCheckClient.connected) {
          console.log(
            'health status after 12 sec',
            self.healthCheckClient.connected,
          );
          EventRegister.emit('exitRoom');
        }
      }, 20000);
    });
  }

  startHealthTimer() {
    const self = this;
    this.request({
      event: 'ping',
      data: {},
    });
    this.pingPongStatus = true;
    clearTimeout(socketHealthTimer);
    socketHealthTimer = setTimeout(() => {
      if (this.pingPongStatus) {
        self.closeSocket();
      } else {
        this.startHealthTimer();
      }
    }, 3000);
  }

  handleSocketHealth() {
    this.pingPongStatus = false;
  }

  // ** INITIALIZE SOCKET **
  initSockets(isJoinRcv, healthId = this.healthCheckClient.id) {
    this.executeJoinRcv = isJoinRcv;
    // eslint-disable-next-line no-undef
    this.socket = new WebSocket(SOCKET_SERVER);
    const self = this;
    // add isTeacher key to user object for online/offline list
    self.user.isTeacher = self.isTeacher;
    this.socket.onopen = () => {
      console.log('socket is open');
      // if (fromConstructor) {
      self.startHealthTimer();

      self.request({
        event: 'joinRoom',
        data: {
          user: self.user,
          userId: self.user_id,
          userName: self.userName,
          roomId: self.room_id,
          platform: self.platform,
          isTeacher: self.isTeacher,
          healthCheckId: healthId,
        },
      });
      // } else {
      //   self.request('updateJoin', { isTeacher: self.isTeacher });
      //   self.resumeServices();
      // }
    };

    this.socket.onerror = reason => {
      this.socket.close();
    };

    this.socket.onclose = () => {
      EventRegister.emit('socketClose');
    };

    this.socket.onmessage = message => {
      const payload = self.handleResponse(message.data);
      if (payload.event != 'pong') {
        console.log('onmessage', payload, payload.event, payload.data);
      }

      switch (payload.event) {
        case 'rcvChat':
          EventRegister.emit('chatRcv', payload.data.data.message);
          break;
        case 'pong':
          self.handleSocketHealth();
          break;
        case 'serverInitialized':
          EventRegister.emit('serverInitialized');
          break;
        case 'settingupServerRcv':
          EventRegister.emit('settingupServerRcv');
          break;
        case 'joinRcv':
          self.joinRcv(payload.data);
          break;
        case 'getRouterRtpCapabilitiesRcv':
          self.getRouterRtpCapabilitiesRcv(payload.data);
          break;
        // case 'getProducersRcv':
        //   self.getProducersRcv(payload.data);
        //   break;
        case 'createWebRtcTransportProducerRcv':
          self.createWebRtcTransportProducerRcv(payload.data);
          break;
        case 'createWebRtcTransportConsumerRcv':
          self.createWebRtcTransportConsumerRcv(payload.data);
          break;
        case 'newProducers':
          self.newProducers(payload.data);
          break;
        case 'getConsumeStreamRcv':
          self.getConsumeStreamRcv(payload.data);
          break;
        case 'dataConsumerRcv':
          self._handleNewDataConsumer(payload.data);
          break;
        case 'removeConsumerRcv':
          self.removeConsumerRcv(payload.data);
          break;
        case 'producerClosedRcv':
          self.producerClosedRcv(payload.data);
          break;
        case 'consumerClosedRcv':
          self.removeConsumer(payload.data.consumerId);
          break;
        case 'iceRestartConsumerRcv':
          self.onIceRestartConsumerReceive(payload.data);
          break;
        case 'iceRestartProducerRcv':
          self.onIceRestartProducerReceive(payload.data);
          break;
        case 'openBoardRcv':
          EventRegister.emit('openBoard');
          break;
        case 'closeBoardRcv':
          EventRegister.emit('closeBoard');
          break;
        case 'boardDataRcv':
          EventRegister.emit('boardDataRcv', payload.data.data);
          break;
        case 'updateRaiseHandQueue':
          EventRegister.emit('updateRaiseHandQueue', payload.data);
          break;
        case 'isHandRaiseActive':
          EventRegister.emit('isHandRaiseActive', payload.data);
          break;
        case 'raiseHandRequestRcv':
          EventRegister.emit('raiseHandRequestRcv', payload.data);
          break;
        case 'acceptHandRequestRcv':
          EventRegister.emit('acceptHandRequestRcv', payload.data);
          break;
        case 'rejectHandRequestRcv':
          EventRegister.emit(
            'rejectHandRequestRcv',
            payload.data.teacher.userId,
          );
          break;
        case 'chatRcv':
          EventRegister.emit('chatRcv', payload.data);
          break;
        case 'userList':
          self.updateUserList(payload.data);
          break;
        case 'userJoined':
          {
            const data = {
              user: payload.data.user,
            };
            EventRegister.emit('userJoined', data);
          }
          break;
        case 'userRejoined':
          {
            const data = {
              user: payload.data.user,
            };
            EventRegister.emit('userJoined', data);
          }
          break;
        case 'userLeft':
          {
            const data = {
              user: payload.data.user,
            };
            EventRegister.emit('userLeft', data);
          }
          break;
        case 'activeSpeaker':
          {
            self.activeSpeaker = self.remoteMedia.filter(
              media =>
                media.audio &&
                media.audio.producer_id === payload.data.producerId,
            );
            const myAudioId = self.producerLabel.get(MEDIA_TYPE.audio);
            if (payload.data.producerId === myAudioId) {
              self.activeSpeaker = {userName: 'Me'};
            } else if (self.activeSpeaker.length) {
              // eslint-disable-next-line
              self.activeSpeaker = self.activeSpeaker[0];
            } else {
              // Do nothing
            }
            EventRegister.emit('activeSpeaker', self.activeSpeaker);
          }
          break;
        case 'exitRoomRcv':
          self.clean();
          break;
        default:
          break;
      }
    };
  }

  removeConsumerRcv(response) {
    console.log('removeConsumerRcv', response, this.remoteMedia);
    this.remoteMedia.forEach(item => {
      if (
        typeof item.video !== 'undefined' &&
        item.userId === response.userId
      ) {
        console.log('called removeConsumer', item);
        this.removeConsumer(item.video.id);
      }
    });
  }

  joinRcv(response) {
    if (!this.executeJoinRcv) {
      console.log('not executing join rcv');
      // this.handleProducerTransportFail();
      // this.handleConsumerTransportFail();
      return;
    }
    if (response.status === 'Success') {
      EventRegister.emit('joinRcv', response);
      if (this.classMode != 'offline') {
        this.request({
          event: 'getRouterRtpCapabilities',
          data: {
            roomId: this.room_id,
            userId: this.user_id,
          },
        });
      }
    } else {
      EventRegister.emit('joinFail', 'joinrcv failed');
    }
  }

  async getRouterRtpCapabilitiesRcv(data) {
    try {
      const device = await this.loadDevice(data.body);
      this.device = device;

      device.observer.on('newtransport', transport => {
        console.log('new transport created [transport.id:%s]', transport.id);

        transport.observer.on('close', () => {
          console.log('transport close', transport);
          // console.log('transport closed [transport.id:%s]', transport.id);
          if (transport.direction == 'send') {
            EventRegister.emit('producerTransportClosed');
          } else if (transport.direction == 'recv') {
            EventRegister.emit('consumerTransportClosed');
          } else {
            // Do nothing
          }
        });
      });
      // this.request('resetClosedProducers', { room_id: this.room_id, user_id: this.user_id });
      this.initSendTransports(device, false);
      EventRegister.emit('producerTransportInit');
    } catch (error) {
      Sentry.captureException(error);
    }
  }

  async loadDevice(routerRtpCapabilities) {
    let device;
    registerGlobals();

    try {
      device = new mediasoupClient.Device({handlerName: 'ReactNative'});
    } catch (error) {
      if (error.name === 'UnsupportedError') {
        console.error('browser not supported');
      }
      return false;
    }
    await device.load({
      routerRtpCapabilities,
    });
    return device;
  }

  async initSendTransports(device, reconnect) {
    this.request({
      event: 'createWebRtcTransport',
      data: {
        forceTcp: false,
        rtpCapabilities: device.rtpCapabilities,
        roomId: this.room_id,
        userId: this.user_id,
        producing: true,
        consuming: false,
      },
    });
    if (!reconnect) {
      this.initReceiveTransports(device);
    }
  }

  createWebRtcTransportProducerRcv(data, produceCallBack) {
    console.log('createWebRtcTransportProducerRcv', data);
    const self = this;
    try {
      this.producerTransport = this.device.createSendTransport(data);
      produceCallBack();
    } catch (e) {
      console.log('produce trans errr');
    }
    this.producerTransport.observer.on('newdataproducer', dataProducer => {
      console.log(
        'new data producer created [transport.id:%s, dataProducer.id:%s]',
        this.producerTransport.id,
        dataProducer,
      );

      console.log('new data producer created', dataProducer);
      if (boardOpenTimer) {
        clearTimeout(boardOpenTimer);
      }
      boardOpenTimer = setTimeout(() => {
        EventRegister.emit('dataProducerConnected', dataProducer.label);
        // if (dataProducer.label == 'board') {
        //   if (self.isCanvasOpen) {
        //     self.openCanvas();
        //   }
        //   const { pages, switchStudentCanvas } = store.getState().liveClass;
        //   const data = {
        //     type: 'switchPage',
        //     data: switchStudentCanvas,
        //     // pageData: pages[switchStudentCanvas],
        //   };
        //   self.sendCanvasData(data);
        // }
      }, 3000);

      dataProducer.observer.on('close', () => {
        if (this._dataProducers.has(dataProducer.label)) {
          this._dataProducers.delete(dataProducer.label);
        }
        EventRegister.emit('dataProducerClosed', dataProducer.label);

        console.log(
          'data producer closed [dataProducer.id:%s]',
          dataProducer.id,
        );
      });
    });

    this.producerTransport.observer.on('newdataconsumer', dataConsumer => {
      console.log(
        'new data consumer created [transport.id:%s, dataConsumer.id:%s]',
        this.producerTransport.id,
        dataConsumer.id,
      );

      dataConsumer.observer.on('close', () => {
        console.log(
          'data consumer closed [dataConsumer.id:%s]',
          dataConsumer.id,
        );
      });
    });

    this.producerTransport.observer.on('newproducer', producer => {
      console.log(
        'new producer created this.producerTransport.id:%s, producer.id:%s]',
        this.producerTransport.id,
        producer.id,
      );
      producer.observer.on('close', () => {
        EventRegister.emit('producerClosed', producer.kind);

        console.log('##producer closed [producer.id:%s]', producer.id);
      });
    });

    this.producerTransport.observer.on('newconsumer', consumer => {
      console.log(
        'new consumer created [transport.id:%s, consumer.id:%s]',
        consumer.id,
      );
      consumer.observer.on('close', () => {
        console.log('##consumer closed [consumer.id:%s]', consumer.id);
      });
    });
    this.producerTransport.on(
      'connect',
      async ({dtlsParameters}, callback, errback) => {
        try {
          await this.httpRequestToMediaServer(
            `${this.baseUrl}/connectTransport`,
            {
              event: 'connectTransport',
              data: {
                dtlsParameters,
                transport_id: data.id,
                roomId: this.room_id,
                userId: this.user_id,
              },
            },
          );
          callback();
        } catch (error) {
          Sentry.captureException(error);
          errback(error);
        }
      },
    );

    this.producerTransport.on(
      'produce',
      async ({kind, rtpParameters}, callback, errback) => {
        if (this.producerTransport.closed) {
          return;
        }
        try {
          const produceResponse = await this.httpRequestToMediaServer(
            `${this.baseUrl}/produce`,
            {
              event: 'produce',
              data: {
                producerTransportId: this.producerTransport.id,
                kind,
                rtpParameters,
                userId: this.user_id,
                roomId: this.room_id,
              },
            },
          );
          await this.request({
            event: 'broadcastProducer',
            data: {
              producer_id: produceResponse.producer[0].producer_id,
              userId: this.user_id,
              roomId: this.room_id, // for clients
            },
          });
          const {producer_id} = produceResponse.producer[0];
          if (kind === 'audioType') {
            EventRegister.emit('audioReady');
          }
          callback({
            id: producer_id,
          });
        } catch (error) {
          Sentry.captureException(error);
          errback(error);
        }
      },
    );

    this.producerTransport.on('connectionstatechange', state => {
      switch (state) {
        case 'connecting':
          break;
        case 'connected':
          break;
        case 'failed':
          this.producerTransport.close();
          break;
        default:
          break;
      }
    });

    this.producerTransport.on(
      'producedata',
      async (
        {sctpStreamParameters, label, protocol, appData},
        callback,
        errback,
      ) => {
        // sctpStreamParameters.streamId = parseInt(this.user_id);
        if (this.producerTransport.closed) {
          return;
        }
        try {
          const res = await this.httpRequestToMediaServer(
            `${this.baseUrl}/produceData`,
            {
              event: 'produceData',
              data: {
                transportId: this.producerTransport.id,
                sctpStreamParameters,
                label,
                protocol,
                appData,
                roomId: this.room_id,
                userId: this.user_id,
              },
            },
          );

          console.log('produceData res', res);

          await this.request({
            event: 'broadcastDataProducer',
            data: {
              consumersToBroadcast: res.consumersToBroadcast,
              userId: this.user_id,
              roomId: this.room_id,
            },
          });
          const {id} = res.dataProducer;
          callback({id});
        } catch (error) {
          Sentry.captureException(error);
          errback(error);
        }
      },
    );
  }

  handleProducerTransportFail() {
    // this.producerTransport.close();
    const {networkState} = store.getState().common;
    if (
      this.healthCheckClient.connected &&
      this.socket.readyState === 1 &&
      networkState.isConnected
    ) {
      Sentry.addBreadcrumb({
        category: 'reconnect',
        message: 'reconnect producer transport',
        level: Sentry.Severity.Info,
      });
      this.initSendTransports(this.device, true);
      console.log('called initSendTransports', this.device);
    } else {
      // Do nothing
      Sentry.addBreadcrumb({
        category: 'reconnect',
        message: 'Could not reconnect producer transport',
        level: Sentry.Severity.Info,
      });
    }
  }

  handleConsumerTransportFail() {
    const {networkState} = store.getState().common;
    if (
      this.healthCheckClient.connected &&
      this.socket.readyState === 1 &&
      networkState.isConnected
    ) {
      Sentry.addBreadcrumb({
        category: 'reconnect',
        message: 'reconnect consumer transport',
        level: Sentry.Severity.Info,
      });
      this.initReceiveTransports(this.device);
      console.log('called initReceiveTransports', this.device);
    } else {
      // Do nothing
      Sentry.addBreadcrumb({
        category: 'reconnect',
        message: 'Could not reconnect consumer transport',
        level: Sentry.Severity.Info,
      });
    }
  }

  deleteProducerId(producer_id) {
    if (this.producers.has(producer_id)) {
      this.producers.delete(producer_id);
    }
  }

  handleProducerFail(kind) {
    try {
      const producer_id = this.producerLabel.get(`${kind}Type`);
      if (this.producers.has(producer_id)) {
        this.producers.get(producer_id).close();
      }
      this.deleteProducerId(producer_id);
      this.producerLabel.delete(`${kind}Type`);
      // if (
      //   this.healthCheckClient.connected
      //   && this.socket.readyState === 1
      //   && !this.producerTransport.closed
      // ) {
      //   Sentry.addBreadcrumb({
      //     category: 'reconnect',
      //     message: 'reconnect producer',
      //     level: Sentry.Severity.Info,
      //   });
      //   console.log('handleProducerFail', 'producerReinit');
      //   // EventRegister.emit('producerReinit', kind);
      // } else {
      //   // Do nothing
      //   Sentry.addBreadcrumb({
      //     category: 'reconnect',
      //     message: 'Could not reconnect producer',
      //     level: Sentry.Severity.Info,
      //   });
      // }
    } catch (error) {
      console.log('aaya pakad mein', error);
    }
  }

  initReceiveTransports(device) {
    if (typeof device === 'undefined') {
      // TODO:
      return;
    }
    this.request({
      event: 'createWebRtcTransportConsumer',
      data: {
        forceTcp: false,
        rtpCapabilities: device.rtpCapabilities,
        roomId: this.room_id,
        userId: this.user_id,
        producing: false,
        consuming: true,
      },
    });
  }

  async createWebRtcTransportConsumerRcv(data) {
    // TODO: Retry mechanism to be added
    if (data == 'Error') {
      return;
    }
    this.consumerTransport = this.device.createRecvTransport(data);
    if (
      typeof data === 'undefined' ||
      typeof this.consumerTransport === 'undefined'
    ) {
      return;
    }
    const self = this;
    this.consumerTransport.on(
      'connect',
      async ({dtlsParameters}, callback, errback) => {
        if (self.consumerTransport.closed) {
          return;
        }
        try {
          await self.httpRequestToMediaServer(
            `${this.baseUrl}/connectTransport`,
            {
              event: 'connectTransport',
              data: {
                dtlsParameters,
                transport_id: data.id,
                roomId: self.room_id,
                userId: self.user_id,
              },
            },
          );
          callback();
        } catch (error) {
          Sentry.captureException(error);
          errback(error);
        }
      },
    );

    this.consumerTransport.on('connectionstatechange', async state => {
      switch (state) {
        case 'connecting':
          break;
        case 'connected':
          break;
        case 'failed':
          if (!self.consumerTransport.closed) {
            self.consumerTransport.close();
          }
          break;
        default:
          break;
      }
    });
    const response = await this.httpRequestToMediaServer(
      `${this.baseUrl}/getProducers`,
      {
        event: 'getProducers',
        data: {
          roomId: this.room_id,
          userId: this.user_id,
        },
      },
    );
    console.log('response yo', response);
    this.getProducersRcv(response);

    if (this.isTeacher) {
      this.enableDataProducer({label: 'board'});
    }
    this.enableDataProducer({label: 'chat'});
  }

  async getProducersRcv(body) {
    EventRegister.emit('mediaReady', body);
    this.newProducers(body.producers);
    this.newDataConsumers(body.consumersToSubscribe);
  }

  async newProducers(producers) {
    for (const {producer_id, userId} of producers) {
      // eslint-disable-next-line no-await-in-loop
      await this.consume(producer_id, userId);
    }
  }

  async newDataConsumers(consumers) {
    for (const consumer of consumers) {
      this._handleNewDataConsumer(consumer);
    }
  }

  updateUserList(users) {
    if (!users.length) {
      return;
    }
    this.userList = users;
    EventRegister.emit('userList', this.userList);
  }

  openCanvas() {
    const data = {
      event: 'openBoard',
      boardData: {},
    };
    this.isCanvasOpen = true;
    this.sendBoardMessage(JSON.stringify(data));
  }

  closeCanvas() {
    const data = {
      event: 'closeBoard',
      boardData: {},
    };
    this.isCanvasOpen = false;
    this.sendBoardMessage(JSON.stringify(data));
  }

  sendCanvasData(payload) {
    const data = {
      event: 'boardData',
      boardData: payload,
    };
    this.sendBoardMessage(JSON.stringify(data));
  }

  raiseHandRequest() {
    this.request({
      event: 'requestHandRaise',
      data: {
        roomId: this.room_id,
        userId: this.user_id,
        userName: this.userName,
        user: this.user,
      },
    });
  }

  acceptHandRequest(userId) {
    this.request({
      event: 'acceptHandRaise',
      data: {roomId: this.room_id, userId: this.user_id, studentId: userId},
    });
  }

  rejectHandRequest(userId) {
    this.request({
      event: 'rejectHandRaise',
      data: {roomId: this.room_id, userId: this.user_id, studentId: userId},
    });
  }

  /// ///// MAIN FUNCTIONS /////////////

  async produce(type) {
    let mediaConstraints = {};
    let audio = false;
    let screen = false;
    switch (type) {
      case MEDIA_TYPE.audio:
        mediaConstraints = {
          audio: true,
          video: false,
        };
        audio = true;
        break;
      case MEDIA_TYPE.video:
        mediaConstraints = {
          audio: false,
          video: {
            width: {
              min: 240,
              ideal: 720,
            },
            height: {
              min: 240,
              ideal: 600,
            },
            aspectRatio: {
              ideal: 1.7777777778,
            },
          },
        };
        break;
      case MEDIA_TYPE.screen:
        mediaConstraints = false;
        screen = true;
        break;
      default:
        return;
    }
    if (!this.device.canProduce('video') && !audio) {
      console.error('cannot produce video');
      return;
    }
    if (this.producerLabel.has(type)) {
      const producer_id = this.producerLabel.get(type);
      if (this.producers.has(producer_id)) {
        this.producers.get(producer_id).close();
      }
      this.deleteProducerId(producer_id);
      this.producerLabel.delete(type);
    }
    let stream;
    try {
      stream = screen
        ? await navigator.mediaDevices.getDisplayMedia() // eslint-disable-line no-undef
        : await navigator.mediaDevices.getUserMedia(mediaConstraints); // eslint-disable-next-line no-undef

      const track = audio
        ? stream.getAudioTracks()[0]
        : stream.getVideoTracks()[0];
      const params = {
        track,
        userId: this.user_id,
        roomId: this.room_id,
      };
      if (!audio && !screen) {
        params.encodings = [
          {
            rid: 'r0',
            maxBitrate: 900000,
            // scaleResolutionDownBy: 10.0,
            scalabilityMode: 'S1T3',
          },
          {
            rid: 'r1',
            maxBitrate: 900000,
            scalabilityMode: 'S1T3',
          },
          {
            rid: 'r2',
            maxBitrate: 900000,
            scalabilityMode: 'S1T3',
          },
        ];
        params.codecOptions = {
          videoGoogleStartBitrate: 1000,
        };
      }
      producer = await this.producerTransport.produce(params);
      this.producers.set(producer.id, producer);
      this.producerLabel.set(type, producer.id);

      if (!audio) {
        this.localMedia = {id: producer.id, stream};
        EventRegister.emit('localMedia', this.localMedia);
      } else {
        EventRegister.emit('audioReady', true);
      }

      producer.on('trackended', () => {
        if (!audio) {
          this.localMedia.stream.getTracks().forEach(track => {
            track.stop();
          });
          this.localMedia = null;
          EventRegister.emit('localMedia', this.localMedia);
        }
        this.deleteProducerId(producer.id);
      });

      producer.on('transportclose', () => {
        if (!audio) {
          this.localMedia.stream.getTracks().forEach(track => {
            track.stop();
          });
          this.localMedia = null;
          EventRegister.emit('localMedia', this.localMedia);
        }
        this.deleteProducerId(producer.id);
      });

      producer.on('close', () => {
        if (!audio) {
          this.localMedia.stream.getTracks().forEach(track => {
            track.stop();
          });
          this.localMedia = null;
          EventRegister.emit('localMedia', this.localMedia);
        }
        this.deleteProducerId(producer.id);
      });

      switch (type) {
        case MEDIA_TYPE.audio:
          this.event(_EVENTS.startAudio);
          break;
        case MEDIA_TYPE.video:
          this.event(_EVENTS.startVideo);
          break;
        case MEDIA_TYPE.screen:
          this.event(_EVENTS.startScreen);
          break;
        default:
          return;
      }
    } catch (error) {
      Sentry.captureException(error);
    }
  }

  async consume(producer_id, userId) {
    this.getConsumeStream(producer_id, userId);
  }

  async getConsumeStream(producerId, userId) {
    const {rtpCapabilities} = this.device;
    if (!rtpCapabilities) {
      return;
    }
    // if the transport is already in closed state
    if (this.consumerTransport && this.consumerTransport.closed) {
      // EventRegister.emit('joinFail', 'this.consumerTransport closed');
      return;
    }
    const consumeResponse = await this.httpRequestToMediaServer(
      `${this.baseUrl}/consume`,
      {
        event: 'consume',
        data: {
          rtpCapabilities,
          consumerTransportId: this.consumerTransport.id, // might be
          producerId,
          userId: this.user_id,
          roomId: this.room_id,
          producer_userId: userId,
        },
      },
    );
    this.getConsumeStreamRcv(consumeResponse);
  }

  async getConsumeStreamRcv(data) {
    if (!data) {
      // TODO:
      return;
    }
    const {id, kind, rtpParameters, userName, producerId, userId} = data;

    const codecOptions = {};
    // if consumer transport is closed return;
    if (this.consumerTransport.closed) {
      return;
    }
    try {
      const consumer = await this.consumerTransport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        codecOptions,
      });
      // eslint-disable-next-line no-undef
      const stream = new MediaStream();
      stream.addTrack(consumer.track);
      this.afterRcvStream({
        consumer,
        stream,
        kind,
        userName,
        userId,
        producer_id: producerId,
      });
    } catch (error) {
      Sentry.captureException(error);
      console.log('could not create consumer', error);
    }
  }

  afterRcvStream(streamProps) {
    const {consumer, stream, kind, producer_id, userName, userId} = streamProps;

    this.consumers.set(consumer.id, consumer);
    const remoteStream = {
      id: consumer.id,
      stream,
      producer_id,
    };
    this.remoteMedia = this.remoteMedia.map(stream => {
      let data = {};
      if (stream.userId === userId) {
        data = {
          userName,
          userId,
          [kind]: remoteStream,
        };
        Object.assign(stream, data);
        EventRegister.emit('remoteMedia', this.remoteMedia);
        return stream;
      }
      return stream;
    });

    const streamExists = this.remoteMedia.find(
      stream => stream.userId === userId,
    );

    if (!streamExists) {
      const data = {
        userName,
        userId,
        [kind]: remoteStream,
      };
      this.remoteMedia.push(data);
      EventRegister.emit('remoteMedia', this.remoteMedia);
    }

    consumer.on('trackended', () => {
      this.removeConsumer(consumer.id);
    });
    consumer.on('transportclose', () => {
      this.removeConsumer(consumer.id);
    });
    consumer.on('producerclose', () => {
      this.removeConsumer(consumer.id);
    });
  }

  async resumeServices() {
    const producerTransportId = this.producerTransport.id;
    const transport_id = this.consumerTransport.id;
    this.request('iceRestartConsumer', {transport_id});
    this.request('iceRestartProducer', {transport_id: producerTransportId});
  }

  async onIceRestartProducerReceive(iceParameters) {
    try {
      await this.producerTransport.restartIce({
        iceParameters: iceParameters.iceParameters,
      });
      this.producers.forEach(async producer => {
        if (producer.kind !== 'audio') {
          await producer.resume();
        }
      });
      EventRegister.emit('audioReady');
    } catch (error) {
      console.log(error);
    }
  }

  async onIceRestartConsumerReceive(iceParameters) {
    try {
      await this.consumerTransport.restartIce({
        iceParameters: iceParameters.iceParameters,
      });
      this.consumers.forEach(async consumer => {
        await consumer.resume();
      });
    } catch (error) {
      console.log(error);
    }
  }

  closeProducer(type) {
    if (!this.producerLabel.has(type)) {
      // console.log(`there is no producer for this type ${type}`);
      return;
    }
    const producer_id = this.producerLabel.get(type);
    this.producers.get(producer_id).close();
    this.deleteProducerId(producer_id);
    this.producerLabel.delete(type);

    switch (type) {
      case MEDIA_TYPE.audio:
        this.event(_EVENTS.stopAudio);
        break;
      case MEDIA_TYPE.video:
        this.event(_EVENTS.stopVideo);
        break;
      case MEDIA_TYPE.screen:
        this.event(_EVENTS.stopScreen);
        break;
      default:
        break;
    }
  }

  producerClosedRcv(data) {
    Array.from(this.consumers.values()).forEach(consumer => {
      if (consumer.producerId === data.producer_id) {
        this.removeConsumer(consumer.id);
      }
    });
  }

  async pauseProducer(type) {
    if (!this.producerLabel.has(type)) {
      console.log(`there is no producer for this type ${type}`);
      return;
    }
    const producer_id = this.producerLabel.get(type);
    try {
      await this.httpRequestToMediaServer(`${this.baseUrl}/pauseProducer`, {
        event: 'pauseProducer',
        data: {
          roomId: this.room_id,
          userId: this.user_id,
          producer_id,
        },
      });

      this.producers.get(producer_id).pause();
      EventRegister.emit('mediaPause', type);
    } catch (error) {
      Sentry.captureException(error);
      console.log('pauseProducer error', error);
    }
  }

  pauseProducerRemote(producer_id) {
    this.producers.get(producer_id).pause();
  }

  resumeProducerRemote(producer_id) {
    this.producers.get(producer_id).resume();
  }

  async resumeProducer(type) {
    if (!this.producerLabel.has(type)) {
      console.log(`there is no producer for this type ${type}`);
      return this.produce(type);
    }
    const producer_id = this.producerLabel.get(type);
    try {
      await this.httpRequestToMediaServer(`${this.baseUrl}/resumeProducer`, {
        event: 'resumeProducer',
        data: {
          roomId: this.room_id,
          userId: this.user_id,
          producer_id,
        },
      });
      this.producers.get(producer_id).resume();
      EventRegister.emit('mediaResume', type);
    } catch (error) {
      console.log('pauseProducer error', error);
      Sentry.captureException(error);
    }
    return true;
  }

  removeConsumer(consumer_id) {
    this.remoteMedia.forEach(med => {
      if (med.video && med.video.id === consumer_id) {
        med.video.stream.getTracks().forEach(track => track.stop());
        med.video = null;
      } else if (med.audio && med.audio.id === consumer_id) {
        med.audio.stream.getTracks().forEach(track => track.stop());
        med.audio = null;
      }
    });

    this.remoteMedia = this.remoteMedia.filter(
      med => med.audio !== null || med.video !== null,
    );
    EventRegister.emit('remoteMedia', this.remoteMedia);
    this.consumers.delete(consumer_id);
  }

  clean() {
    clearTimeout(socketHealthTimer);
    this.healthCheckClient.close();
    this.socket.close();
    this._isOpen = false;
    this.classMode = '';
    if (this.consumerTransport) {
      this.consumerTransport.close();
    }
    if (this.producerTransport) {
      this.producerTransport.close();
    }

    EventRegister.removeAllListeners();
  }

  exit() {
    console.log('exit', this.user);
    this.request({
      event: 'exitRoom',
      data: {roomId: this.room_id, userId: this.user_id},
    });
    this.clean();
    this.event(_EVENTS.exitRoom);
  }

  disconnect() {
    this.socket.disconnect();
  }

  connect() {
    this.socket.connect();
  }
  /// //// HELPERS //////////
  event(evt) {
    if (this.eventListeners.has(evt)) {
      this.eventListeners.get(evt).forEach(callback => callback());
    }
  }

  on(evt, callback) {
    this.eventListeners.get(evt).push(callback);
  }

  /// ///// GETTERS ////////

  isOpen() {
    return this._isOpen;
  }

  httpRequestToMediaServer(url, body) {
    return new Promise((resolve, reject) => {
      axios({
        method: 'POST',
        url,
        headers: {'Content-Type': 'application/json'},
        data: body,
      })
        .then(response => {
          resolve(response.data.body);
        })
        .catch(err => {
          reject(err);
        });
    });
  }

  async enableDataProducer({label}) {
    if (!this._useDataChannel) {
      return;
    }
    if (
      typeof this.producerTransport === 'undefined' ||
      !this.producerTransport
    ) {
      // TODO:
      return;
    }
    if (this.producerTransport.closed) {
      return;
    }
    console.log('this._dataProducers', this._dataProducers);
    try {
      const dataProducer = await this.producerTransport.produceData({
        ordered: true,
        maxRetransmits: 1,
        label,
        priority: 'medium',
        appData: {info: `${label}-DataProducer`},
      });

      console.log('dataProducer await', dataProducer);

      const dataProducerType = `_${label}DataProducer`;
      if (this._dataProducers.has(label)) {
        this._dataProducers.delete(label);
      }
      this[dataProducerType] = dataProducer;

      this._dataProducers.set(label, dataProducer);

      dataProducer.on('transportclose', () => {
        // console.log('chat DataProducer "transportclose" event');
        // dataProducer = null;
        console.log('on data producer transportclose', label);
        dataProducer.close();
        this._dataProducers.delete(label);
      });
      dataProducer.on('open', () => {
        console.log('dataProducer is now open', label);
      });
      return dataProducer;
    } catch (error) {
      Sentry.captureException(error);
      console.log('enableChatDataProducer() | failed:%o', error);
      // throw error;
    }
  }

  handleDataProducerClosed(label) {
    const {networkState} = store.getState().common;
    if (
      this.healthCheckClient.connected &&
      this.socket.readyState === 1 &&
      !this.producerTransport.closed &&
      networkState.isConnected
    ) {
      Sentry.addBreadcrumb({
        category: 'reconnect',
        message: 'reconnect data producer',
        level: Sentry.Severity.Info,
      });
      this.enableDataProducer({label});
    } else {
      // Do nothing
      Sentry.addBreadcrumb({
        category: 'reconnect',
        message: 'Could not reconnect data producer',
        level: Sentry.Severity.Info,
      });
    }
  }

  async _handleNewDataConsumer(data) {
    if (typeof data === 'undefined') {
      // TODO:
      return;
    }
    if (this.consumerTransport.closed) {
      return;
    }
    const {
      peerId, // NOTE: Null if bot.
      dataProducerId,
      id,
      sctpStreamParameters,
      label,
      protocol,
      appData,
    } = data;
    try {
      const dataConsumer = await this.consumerTransport.consumeData({
        id,
        dataProducerId,
        sctpStreamParameters,
        label,
        protocol,
        appData: {...appData, peerId}, // Trick.
      });
      this._dataConsumers.set(dataConsumer.id, dataConsumer);

      dataConsumer.on('transportclose', () => {
        dataConsumer.close();
        this._dataConsumers.delete(dataConsumer.id);
      });

      dataConsumer.on('open', () => {
        console.log('DataConsumer "open" event');
      });

      dataConsumer.on('close', () => {
        this._dataConsumers.delete(dataConsumer.id);
      });

      dataConsumer.on('error', error => {
        console.log('DataConsumer "error" event:%o', error);
      });
      dataConsumer.on('message', message => {
        if (typeof message !== 'string') {
          return;
        }
        switch (dataConsumer.label) {
          case 'chat': {
            const chatMsg = JSON.parse(message);
            EventRegister.emit('chatRcv', chatMsg.message);
            break;
          }
          case 'board': {
            const boardMsg = JSON.parse(message);
            switch (boardMsg.event) {
              case 'boardData':
                EventRegister.emit('boardDataRcv', boardMsg.boardData);
                break;
              case 'openBoard':
                EventRegister.emit('openBoard');
                break;
              case 'closeBoard':
                EventRegister.emit('closeBoard');
                break;
              default:
            }
            break;
          }
          default:
            console.log('Inside switch default');
        }
      });
    } catch (error) {
      Sentry.captureException(error);
      // EventRegister.emit('joinFail', `unable to consume media ${JSON.stringify(error)}`);
    }
  }

  async sendMessage(payload) {
    console.log('sendMessage', payload);
    let message = false;
    if (Array.isArray(payload)) {
      message = {message: payload[0]};
    } else {
      message = {message: payload};
    }
    console.log('classMode', this.classMode);
    if (this.classMode == 'offline') {
      this.sendOfflineChatMessage(message);
    } else {
      this.sendChatMessage(JSON.stringify(message));
    }
  }

  sendOfflineChatMessage(text) {
    console.log('data', {
      data: text,
      userId: this.user_id,
      roomId: this.room_id,
    });
    this.request({
      event: 'sendChat',
      data: {
        data: text,
        userId: this.user_id,
        roomId: this.room_id,
      },
    });
  }

  async sendChatMessage(text) {
    if (!this._chatDataProducer) {
      console.log({
        type: 'error',
        text: 'No chat DataProducer',
      });
      return;
    }

    try {
      this._chatDataProducer.send(text, 51);
    } catch (error) {
      console.log('chat DataProducer.send() failed:%o', error);
    }
  }

  async sendBoardMessage(text) {
    if (!this._boardDataProducer) {
      console.log('no board data');
      return;
    }

    try {
      this._boardDataProducer.send(text, 51);
    } catch (error) {
      console.log('board _boardDataProducer.send() failed:%o', error);
    }
  }

  // ** HELPER FUNCTIONS **
  request(event) {
    // If socket is not connected, return
    if (this.socket.readyState !== 1) {
      this.socket.close();
      return;
    }
    console.log('event', event);
    try {
      this.socket.send(JSON.stringify({action: 'onMessage', message: event}));
    } catch (error) {
      console.log('stringify error', error);
    }
  }

  setBaseUrl(url) {
    this.baseUrl = url;
  }

  closeSocket() {
    this.socket.close();
  }

  disconnectHealthCheck() {
    this.healthCheckClient.disconnect();
  }

  closeProducerTransport() {
    this.producerTransport.close();
  }

  closeDataProducer(label) {
    this._dataProducers.get(label).close();
    console.log('data producer closed');
  }

  handleResponse(data) {
    return JSON.parse(data);
  }

  static get EVENTS() {
    return _EVENTS;
  }
}
