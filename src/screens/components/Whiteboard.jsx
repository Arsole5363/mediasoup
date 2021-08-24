import React from "react";
import {ReactSketchCanvas}  from "react-sketch-canvas";
import moment from 'moment';
import { connect } from 'react-redux';
import { conferenceActions } from '../../_actions';
import socket from '../../_services/socket';
import LoadingScreen from '../LoadingScreen';

class Whiteboard extends React.Component {
  canvasData;
  canvas;
  constructor(props) {
    super(props);
    this.canvasDataEvents = new Map();
    this.totalEvents = 0;
    this.canvas = React.createRef();
    this.state = {}
  }

  componentDidMount() {
    socket.on('boardDataRcv', function ({ data }) {
      console.log('boardData received', data);
      this.handleRcvData(data);
    }.bind(this))
    this.getRecordedBoard();
    setTimeout(()=> this.loadPath(), 3000);

  }
  
  async getRecordedBoard() {
    let {room_id} = this.props.conference;

    socket.request('getRecordedBoard', {
      room_id,
    }).then(async function ({ recordedBoard }) {
        console.log('getRecordedBoard successfully', recordedBoard);
        this.totalEvents = recordedBoard.length;
        const canvasData = new Map();
        recordedBoard.forEach((evt) => {
          canvasData.set(evt.time, evt);
        })
        this.canvasDataEvents = canvasData;
        this.replay();
    }.bind(this))
  }

  replay(){
    const startTimestamp = moment().startOf('day');
    let eventCount = 0;
    const itr = setInterval(() => {
      startTimestamp.add(1, 'second');
      const playbackTime = startTimestamp.format('HH:mm:ss');
      const nowEvent = this.canvasDataEvents.get(playbackTime);
      if (!nowEvent) {
        return;
      }else if(eventCount > this.totalEvents){
        clearInterval(itr);
      }
      console.log('replay event', playbackTime, nowEvent);
      this.handleRcvData(nowEvent.data);
      eventCount++;
    }, 1000);
  }

  handleRcvData(data){
    let {canvasData} = this.props.conference;


    if(data.type === 'clearCanvas'){
      canvasData.pages[canvasData.currentPage].paths = [];
      this.setState({canvasData});
      this.canvas.current.clearCanvas();
    }else if(data.type === 'undoCanvas'){
      this.canvas.current.undo();
    }else if(data.type === 'switchPage'){
      this.canvas.current.clearCanvas();
      canvasData.currentPage = data.data;
      data.pageData.path.forEach(path => {
        canvasData.pages[data.data].paths.push(path);
      })
      this.setState({canvasData});
    }
    else {

    console.log('main canvas state', canvasData);
    
    // const dataRcv = data.data.path.path.data;
    const currentPage = data.data.currentPage;
    // const stroke = [];
    // let mainObj = {};
    // dataRcv.forEach(item => {
    //   stroke.push(item);
    // });
    // mainObj.paths = stroke;
    // mainObj.strokeWidth = data.data.path.path.width;
    // mainObj.strokeColor = data.data.path.path.color;
    canvasData.pages[currentPage].paths.push(data.data.path);
    console.log('final canvas state', canvasData);
    this.setState({ canvasData: canvasData });
  }
  this.loadPath();

}

  // componentDidMount() {
  //   console.log('componentDidMount');
  //   setTimeout(()=> this.loadPath(), 3000);
  //   // this.loadPath()
  // }

  loadPath() {
    const { canvasData } = this.props.conference;
    console.log('canvasData', canvasData);
    
    let mainArr = [];
    const paths = canvasData.pages[canvasData.currentPage].paths;
    paths.forEach((stroke) => {
      let paths = [];
      let mainObj = {};
      stroke.path.data.forEach((item, index) => {
        const items = item.split(',');
        let obj = {x: '', y: ''};
        obj.x = parseFloat(items[0]) > 0 ? parseFloat(items[0]) : 0;
        obj.y = parseFloat(items[1]) > 0 ? parseFloat(items[1]) : 0;
        paths.push(obj);
      });      
      mainObj.paths = paths;
      mainObj.strokeWidth = stroke.path.width;
      // if(element.path.color === '#00000000') {
      mainObj.strokeColor = stroke.path.color;
      // } else {
        // mainObj.strokeColor = element.path.color;
      // }
      mainObj.drawMode = true;
      mainArr.push(mainObj);
    });    
    console.log('mainArray', mainArr);
    this.canvas.current.loadPaths(mainArr);
  }


  render() {
    if(!this.props.conference ){
      return (<LoadingScreen />);
    }
    const { canvasData } = this.props.conference;
    
    return (
      <div className="canvasContainer">
              <ReactSketchCanvas
                ref={this.canvas}
                width="100%"
                height="100%"
                strokeWidth={5}
                strokeColor="black"
                allowOnlyPointerType={"all"} 
                />
                {canvasData.currentPage + 1}
         </div>
    );
  }
}

function mapState(state) {
  const { conference } = state;
  return { conference };
}

const actionCreators = {
  boardDataRcv: conferenceActions.boardDataRcv,
};

const connectedWhiteBoard = connect(mapState, actionCreators)(Whiteboard);
export { connectedWhiteBoard as Whiteboard }
