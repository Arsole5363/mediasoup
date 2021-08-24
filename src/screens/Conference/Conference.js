import React, { Component  , useState, useEffect } from 'react';
// import { EventRegister } from 'react-native-event-listeners';
import styled from 'styled-components';
import './style.css';
import ChatHeader from './components/ChatHeader';
import ActionsButtons from '../components/ActionsButtons';
import { Whiteboard } from '../components/Whiteboard';
import {Chat} from '../components/Chat/Chat';
// import socket from '../../_services/socket';
import { connect } from 'react-redux';
import { conferenceActions } from '../../_actions';

import BrigoshaMedia from '../../BrigoshaMedia'
import Emitter from '../../_services/event';
import update from 'react-addons-update';


class Conference extends  React.Component {
    
    constructor(props){
        super(props);
        this.state = {
            stream:null,
            isvideoon:false,
            isaudioon:false,
            login:[false,false],
            
            
        };
        this.videoOn=false;
        this.audioOn=false;
        this.localVideo=null;
        this.rtvideo=null;
        
       
    
    this.media= new BrigoshaMedia()
        // this.handlerbutton = this.handlerbutton.bind(this);
    this.handlerbuttonVideo = this.handlerbuttonVideo.bind(this);
        

    }
    first = async()=>{
        const   {user_id,room_id,user} = this.props.conference
      console.log(user_id,room_id,user.name)
     await this.media.init(user_id, room_id, user.name, user, false,'android' ,'3465477898', 'online')
     
        
    }
    async random(){
        await this.first()
        // this.setState({...this.state,remotestream:this.media.remoteMedia[0].video.stream})
        // console.log('remotestream------>',this.media.remoteMedia)

    }
    

    componentDidMount(){
        // this.localvideo=document.getElementById('videoCtr');
        
        const {room_id, user_id, user, isTeacher} = this.props.conference;
        this.props.createRoom(room_id, user_id, user, isTeacher);
        this.props.join(room_id, user_id, user, isTeacher);
        
        this.random()
        Emitter.on('remotevideopaused',()=>{
            var remotevideo =document.getElementById('remoteVideoCtr')
            
        console.log('video paused from remotestream')
        remotevideo.srcObject= null

        })
        Emitter.on('producersCreated',(e)=>{
            this.setState(update(this.state, {
	        login: {
		            [0]: {
			        $set: true
		                }   
	                }
            }));
            




        })
        Emitter.on('newProducer',(e)=>{
            try{
                
            var remotevideo =document.getElementById('remoteVideoCtr')
            var remoteaudio=document.getElementById('remoteaudio')
            // remotevideo.srcObject= this.media.remoteMedia[0].audio.stream

        
              if (this.media.remoteMedia[0].video) {
                 
                  remotevideo.srcObject= this.media.remoteMedia[0].video.stream
              }
              if(this.media.remoteMedia[0].audio){
                  
                  remoteaudio.srcObject= this.media.remoteMedia[0].audio.stream
              }
            
            
          }
            
            catch(e){
                console.log(e)
            }
            
        })


        Emitter.on('allConsumeDone',(e)=>{
            this.setState(update(this.state, {
                login: {
                    [1]: {
                    $set: true
                    }
                }
            }));
            try{var remotevideo =document.getElementById('remoteVideoCtr')
        console.log('stearm ------>',this.media.remoteMedia[0].video.stream)
        remotevideo.srcObject= this.media.remoteMedia[0].video.stream}catch(e){

        }
            





        })

        
    
       
        
        

        
        

        
    }
    componentDidUpdate(){
        // this.localvideo=document.getElementById('videoCtr');
        // this.localVideo.srcObject = new MediaStream(this.state.stream)
    }
    
    handlerbuttonVideo=async(e)=>{
        if(!this.state.isvideoon){
            if(!this.media.producerLabel.has('videoType')){

                console.log('it doesn\' t have  video type element')

      
        await this.media.produce('videoType')
        

        // if(this.media.localMedia){
            
            
            var video = document.getElementById('video');
            console.log(video)
            video.srcObject = this.media.localMedia.stream;
            // video.onloadedmetadata = function(e) {
            //     video.play();
            // };



            // console.log('lol ->>>>>>>>',lol)
        this.setState({...this.state,isvideoon:true})
        // console.log(this.state.stream)
            }
            else{
                console.log('it has video type element')

                this.media.resumeProducer('videoType')
                 this.setState({...this.state,isvideoon:true})
            }
        
        }
        else{
            this.media.pauseProducer('videoType')
           this.setState({...this.state,isvideoon:false}) 
        }
        
        
    
   
        
            
    
    }
    handlerbuttonAudio=async()=>{
        if(!this.state.isaudioon){
            if(!this.media.producerLabel.has('audioType')){

                console.log('it doesn\' t have audia type element')

      
        await this.media.produce('audioType')
        

        // if(this.media.localMedia){
            
            
            
            // };



            // console.log('lol ->>>>>>>>',lol)
        this.setState({...this.state,isaudioon:true})
        // console.log(this.state.stream)
            }
            else{
                console.log('it has audio type element')

                this.media.resumeProducer('audioType')
                 this.setState({...this.state,isaudioon:true})
            }
        
        }
        else{
            this.media.pauseProducer('audioType')
           this.setState({...this.state,isaudioon:false}) 
        }
        
         


        
    }
    checkconsole=()=>{
        console.log('stream after pause ->>>>>>',this.media.remoteMedia[0].audio.stream)

    }
    
    render() {
        
    
      

        

        // media.init(user_id, room_id, user.name, user, false, '3465477898', 'online')
        // console.log('device status :' ,media.device)
        
        const { messages } = this.props.conference;
        console.log('stream====', this.state.stream);

        


            if (this.state.login[0]&&this.state.login[1]){
                return( 
                <>
                <div className="outerContainer">
                    <div className="boardContainer">
                        {/* <div className="whiteBoardContainer">
                            
                            <Whiteboard />
                        </div> */}
                        <div className="videoContainer">
                            <video autoPlay  controls id="video"   width="470" height="400"></video>
                            <video autoPlay muted controls id="remoteVideoCtr" src={this.state.remotestream} width="470" height="400">
                                
                            </video>
                            <audio id='remoteaudio' controls volume="true" autoPlay />
                            
                            {/* <button  onClick={()=>{console.log('hello')}}> ujjwal</button> */}
                            
                        </div>
                
                    </div>
        

                    <div className="userListContainer">
                    <ChatHeader />
                    <Chat  messages={messages} />
                    </div>
                    {/* <ActionsButtons /> */}
        
                </div>
                <button onClick={this.handlerbuttonVideo}>{this.state.isvideoon ? 'Video off' : 'video On'}</button>
                <button onClick={this.handlerbuttonAudio}>{this.state.isaudioon ? 'Mute' : 'Unmute'}</button>
                <button onClick={this.checkconsole}>chack console</button>
            </>)
            }
            else{ return (

            <div style={{ marginTop: "42vh", display:'flex', justifyContent:'center', alignItems:'center'}}><p style={{fontSize:'50px',textAlign:'center'}}>
            
           Please wait <br></br> Joining the class</p></div>
            )

            }
               
                
    
            

    }
}
// export default Conference; 
function mapState(state) {
    
    //user_id, room_id, userName, user, isTeacher, platform, confId, mode
    console.log( state)
    const { conference } = state;
    return { conference };
}

const actionCreators = {
    join: conferenceActions.join,
    createRoom: conferenceActions.createRoom,
    disconnected: conferenceActions.disconnect
};

const connectedConference = connect(mapState, actionCreators)(Conference);
export { connectedConference as Conference };