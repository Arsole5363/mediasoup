import React, { useState, useEffect } from "react";
// import queryString from "query-string";
// import io from "socket.io-client";

import "./Chat.css";
import InfoBar from "../InfoBar/InfoBar";
import Input from "../Input/Input";
import Messages from "../Messages/Messages";
import TextContainer from "../TextContainer/TextContainer";
import { conferenceActions } from '../../../_actions';
import { connect } from 'react-redux';
import socket from '../../../_services/socket';
// let socket;
class Chat extends React.Component {
  constructor(props) {
    super(props);
    this.state = {}
  }
// const Chat = ({ messages }) => {
  // const [name, setName] = useState("");
  // const [room, setRoom] = useState("");
  // const [users, setUsers] = useState("");
  // const [message, setMessage] = useState("");
  // const [messagesArr, setMessages] = useState([]);

  // localhost:5000
  // const ENDPOINT = "https://react-chat-app-joross.herokuapp.com/";

  // useEffect(() => {
  //   // const { name, room } = queryString.parse(location.search);
  //   // socket = io(ENDPOINT);

  //   setName(user_id);
  //   setRoom(room_id);
  // }, [room_id, user_id]);

  // useEffect(() => {
    componentDidMount(){
    

    socket.on("userList", ({ users }) => {
      // setUsers(users);
    });
  }
  //   return () => {
  //     socket.emit("disconnect");
  //     socket.off();
  //   };
  // }, [messagesArr]);



  sendMessage(event) {
    event.preventDefault();

    // if (message) {
    //   socket.reuqest("chatSnd", message, () => setMessage(""));
    // }
  };

  render(){
    const { messages } = this.props.conference;

  return (
    <div className="chatOuterContainer">
      <div className="chatContainer">
        {/* <InfoBar room={room} /> */}
        <Messages messages={messages}/>
        {/* <Input
          message={message}
          setMessage={setMessage}
          sendMessage={sendMessage}
        /> */}
      </div>
      {/* <TextContainer users={users} /> */}
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

const connectedChat = connect(mapState, actionCreators)(Chat);
export { connectedChat as Chat }

// export default Chat;