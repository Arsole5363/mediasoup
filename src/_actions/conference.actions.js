import { conferenceConstants } from '../_constants';
import { userService } from '../_services';
import { alertActions } from '.';
import { history } from '../_helpers';
import socket from '../_services/socket';

export const conferenceActions = {
    createRoom,
    join,
    disconnected,
    login,
};

function createRoom(room_id, user_id, user, isTeacher){
        return dispatch => {
            socket.request('createRoom', {
                room_id
            }).then(() => {
            return dispatch({
                type: conferenceConstants.ROOMCREATE_REQUEST,
                user:{ room_id, user_id } 
            });
       });
    }
}


function disconnected() {
    return { type: conferenceConstants.LOGOUT };
}

function join(room_id, user_id, user, isTeacher) {
  return dispatch => {
    socket.request('join', {
       room_id,
       user_id, 
       user,
       isTeacher 
    }).then(async function (roomstate) {
    //   let { canvasData } = this.state;
        console.log('joined successfully', roomstate.boardData);
        // this.setState({boardData: roomstate.boardData});
        // const canvas = roomstate.boardData;
        // canvasData.currentPage = canvas.currentPage;
        // canvasData.pages[canvas.currentPage].paths = canvas.path;
        // console.log('canvasData is', canvasData);
        // this.setState({canvasData });
        // await this.getRecordedBoard({room_id});
        // this.replay();
        dispatch({
                type: conferenceConstants.JOIN_REQUEST,
                boardData: roomstate.boardData
        });
    })
 }
}

function boardDataRcv(){
    console.log('boardDataRcv called action');
    
}

function login(username, roomname){
    return dispatch => {
        return dispatch({
            type: conferenceConstants.LOGIN_REQUEST,
            user:{ room_id: roomname, username } 
        });
    }
}

  


