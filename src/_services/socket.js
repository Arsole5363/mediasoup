import io from 'socket.io-client';

const socket = io.connect('http://127.0.0.1:1017/', { transports: ['websocket'] });
socket.request = function request(type, data = {}) {
    console.log('sending ',type,data);
    return new Promise((resolve, reject) => {
        socket.emit(type, data, (data) => {
            if (data.error) {
                reject(data.error)
            } else {
                resolve(data)
            }
        })
    })
  }
socket.on(
        'connect',
        function () {
          console.log('connected to ioServer:1017');
})

socket.on("chatRcv",  function ( data ) {
    console.log('chat rcved', data);
    // setMessages([...messagesArr, message]);
  });
  
export default socket;