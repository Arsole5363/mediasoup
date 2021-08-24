import { conferenceConstants } from '../_constants';
let initialState = {
  room_id: '',
  // room_id: 'wntcaw415y',
  user_id: 123,
  user: { name: 'MacOs Catalina' },
  isTeacher: false,
  canvasData : {
    currentPage: 0,
    pages: [
      {paths: []},
      {paths: []},
      {paths: []}
  ],
  },
  messages: [{text: 'May I help you', user:{name:'Debajit'}}]
};
export function conference(state = initialState, action) {
  switch (action.type) {
    
    case conferenceConstants.ROOMCREATE_REQUEST:
      return state;

    case conferenceConstants.LOGIN_REQUEST:
      state.room_id = action.user.room_id;
      state.user.name = action.user.username;
      return state;

    case conferenceConstants.JOIN_REQUEST:
      console.log('action data', action, state);
      
      state.currentPage = action.boardData.currentPage;
      const paths = action.boardData.path;
      paths.forEach((path) => {
        state.canvasData.pages[action.boardData.currentPage].paths.push(path);
      });
      return state;
        
    case conferenceConstants.JOIN_SUCCESS:
      console.log('join success red', action.boardData);
      
      return {
        loggingIn: true,
        boardData: action.boardData,
        conference: action.conference
      };
    
    default:
      return state
  }
}