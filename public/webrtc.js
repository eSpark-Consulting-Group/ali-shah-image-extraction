/* Copyright 2022 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// WebRTC Variables:
let localPeerConnection;
let localSendChannel;
let localStream;
let remoteStream;
let offerSDP = "";
let initialized = false;
let videoElement;

// WebRTC Configurations:
const localOfferOptions = {
  offerToReceiveVideo: 1,
  offerToReceiveAudio: 1,
};

const mediaStreamConstraints = {
  audio: false,
  video: false,
};

/// WebRTC Analytics ///

// Page launch
let timestampInitializeWebRTC;
let timestampStartLocalStream;
let timestampCreateSdpOffer;
let timestampCreateSdpOfferSuccess;
let timestampSetLocalDescription;
let timestampSetLocalDescriptionSuccess;

// Camera Stream button pressed
let timestampGenerateStreamRequest;
let timestampGenerateWebRtcStreamRequest; // senderSdpOffer
let timestampGenerateStreamResponse; // sendSdpOffer success / timestampSdpAnswerReceived
let timestampExtendStreamRequest;
let timestampExtendWebRtcStreamRequest;
let timestampExtendStreamResponse;
let timestampStopStreamRequest;
let timestampStopWebRtcStreamRequest;
let timestampStopStreamResponse;
let timestampSetRemoteDescription;
let timestampSetRemoteDescriptionSuccess;
let timestampConnected;
let timestampPlaybackStarted;

/// WebRTC Functions ///

/** initializeWebRTC - Triggers starting a new WebRTC stream on initialization */
function initializeWebRTC() {
  if (initialized === true) return;
  timestampInitializeWebRTC = new Date();
  updateAnalytics();
  console.log(`initializeWebRTC() - `, timestampInitializeWebRTC);

  videoElement = document.getElementById("video-stream");
  videoElement.addEventListener("play", (event) => {
    timestampPlaybackStarted = new Date();
    updateAnalytics();
    console.log("playback started - ", timestampPlaybackStarted);
  });

  initialized = true;
  startLocalStream();
}

/** receiveChannelCallback - Handles received channel callback */
const receiveChannelCallback = (event) => {
  console.log("receiveChannelCallback");
  const receiveChannel = event.channel;
  receiveChannel.onmessage = handleReceiveMessage;
};

/** handleReceiveMessage - Handles receiving message */
const handleReceiveMessage = (event) => {
  console.log(`Incoming DataChannel push: ${event.data}`);
};

/** startLocalStream - Starts a WebRTC stream on the browser */
function startLocalStream(mediaStream) {
  timestampStartLocalStream = new Date();
  updateAnalytics();
  console.log(`startLocalStream() - `, timestampStartLocalStream);
  localPeerConnection = null;
  localSendChannel = null;
  localStream = null;
  offerSDP = "";

  remoteStream = new MediaStream();

  const servers = { sdpSemantics: "unified-plan", iceServers: [] };
  localPeerConnection = new RTCPeerConnection(servers);
  localPeerConnection.ondatachannel = receiveChannelCallback;

  localSendChannel = localPeerConnection.createDataChannel(
    "dataSendChannel",
    null
  );
  localPeerConnection.addEventListener(
    "iceconnectionstatechange",
    handleConnectionChange
  );

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => {
      localPeerConnection.addTrack(track, mediaStream);
      console.log(`track added!`);
    });
    localStream = mediaStream;
  }

  localPeerConnection.addEventListener("track", gotRemoteMediaTrack);

  timestampCreateSdpOffer = new Date();
  updateAnalytics();
  console.log(
    "localPeerConnection createOffer start - ",
    timestampCreateSdpOffer
  );
  localPeerConnection
    .createOffer(localOfferOptions)
    .then(createdOffer)
    .catch(setSessionDescriptionError);
}

/** createdOffer - Handles local offerSDP creation */
function createdOffer(description) {
  timestampCreateSdpOfferSuccess = new Date();
  updateAnalytics();
  console.log(`createdOffer() - `, timestampCreateSdpOfferSuccess);
  updateOfferSDP(description.sdp);
  console.log(JSON.stringify(description.sdp), "locallllll");
  localStorage.setItem("offerSDP", description.sdp);
  getAnswerSDPHandler(description.sdp);
  timestampSetLocalDescription = new Date();
  updateAnalytics();
  console.log(`setLocalDescription() - `, timestampSetLocalDescription);
  localPeerConnection
    .setLocalDescription(description)
    .then(() => {
      setLocalDescriptionSuccess(localPeerConnection);
    })
    .catch(setSessionDescriptionError);
}

const button = document.getElementById("live123");
button.onclick = showLiveHandler;

function convertImageFile(base64) {
  let base64String = base64;

  if (base64String.includes("base64,")) {
    base64String = base64String.split("base64,")[1];
  }

  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length)
    .fill()
    .map((_, i) => byteCharacters.charCodeAt(i));
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "image/jpeg" });

  // Convert Blob to a File object
  const file = new File([blob], "screenshot.jpg", { type: "image/jpeg" });
  console.log(file, "asdhaskdgsd");
  return file;
}

function takeScreenShot(obj) {
  console.log(obj);
  const video = document.getElementById("video123");
  const canvas = document.getElementById("canvas");
  const context = canvas.getContext("2d");
  // Set canvas dimensions to video dimensions
  // canvas.width = video.videoWidth;
  // canvas.height = video.videoHeight;
  // Draw the current frame of the video on the canvas
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  // Convert canvas to data URL and display the image
  const dataURL = canvas.toDataURL("image/png");
  const image = convertImageFile(dataURL);
  console.log(image, "iiiiiiii");
  obj.snapshot = image;
  postSnapshot(obj);
  document.getElementById("screenshot").src = dataURL;
  canvas.style.display = "block"; // Optional: Show the canvas for debugging
}

async function streamHandler() {
  const source = new EventSource("http://localhost:8000/stream");
  source.addEventListener(
    "message",
    function (e) {
      const obj = {
        eventId: "031e2405-cde0-4e0c-9f7e-77aeeb1fb337", //random ID
        resourceGroup:
          "enterprises/f311ed2e-cb1c-4758-a8fb-0ac86ccc179a/devices/sample-device-id", // random resource group
      };
      console.log(JSON.parse(e.data), "wwwwwwww");
      takeScreenShot(obj);
    },
    false
  );
}

function showLiveHandler() {
  console.log("call answer");
  const ansSDP = localStorage.getItem("answerSDP");
  console.log(ansSDP, "ansSDPansSDP");
  updateWebRTC(ansSDP);
  streamHandler();

  // localPeerConnection.setRemoteDescription(
  //   new RTCSessionDescription(JSON.parse(ansSDP))
  // );

  // localPeerConnection.ontrack = (event) => {
  //   console.log(event, "event321");
  //   // Attach event.track to your video element
  //   // const videoElement = document.getElementById("video"); // Your video element ID
  //   // videoElement.srcObject = event.streams[0];
  // };
}

function postSnapshot(data) {
  const formData = new FormData();
  formData.append("snapshot", data.snapshot);
  formData.append("eventId", data.eventId);
  formData.append("resourceGroup", data.resourceGroup);
  fetch("http://localhost:8000/saveSnapshot", {
    method: "POST",
    headers: {
      Cookie:
        "connect.sid=s%3Aa9xRZvcFKobwamQE1a9BjNN4mJoWFaDs.BodHOCxur0RAGqw7SHqwoze8kYMDvORd0acZGRM9KWY",
    },
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => console.log(data))
    .catch((error) => console.error("Error:", error));
}

/** updateWebRTC - Updates WebRTC connection on receiving answerSDP */
function updateWebRTC(answerSDP) {
  console.log(`Answer from remotePeerConnection:\n${answerSDP} - `);
  if (answerSDP[answerSDP.length - 1] !== "\n") {
    answerSDP += "\n";
  }

  timestampSetRemoteDescription = new Date();
  updateAnalytics();
  console.log(`setRemoteDescription() - `, timestampSetRemoteDescription);
  localPeerConnection
    .setRemoteDescription({ type: "answer", sdp: answerSDP })
    .then(() => {
      setRemoteDescriptionSuccess(localPeerConnection);
      document.getElementById("livebtn").disabled = true;
      document.getElementById("livebtn").style.cursor = "no-drop";
    })
    .catch(setSessionDescriptionError);
}

/// Helper Functions ///

/** getPeerName - Handles received peer name */
function getPeerName(peerConnection) {
  console.log(`getPeerName()`);
  return peerConnection === localPeerConnection
    ? "localPeerConnection"
    : "remotePeerConnection";
}

/** gotRemoteMediaTrack - Handles received media track */
function gotRemoteMediaTrack(event) {
  console.log(`gotRemoteMediaTrack()`);
  remoteStream.addTrack(event.track);
  console.log("pppppppppppppppppppp", remoteStream);
  document.getElementById("video123").srcObject = remoteStream;
  console.log("Received remote track.");
}

/** setDescriptionSuccess - Handles received success description */
function setDescriptionSuccess(peerConnection, functionName) {
  console.log(`setDescriptionSuccess()`);
  const peerName = getPeerName(peerConnection);
  console.log(`${peerName} ${functionName} complete`);
}

/** setLocalDescriptionSuccess - Handles received local success description */
function setLocalDescriptionSuccess(peerConnection) {
  timestampSetLocalDescriptionSuccess = new Date();
  updateAnalytics();
  console.log(
    `setLocalDescriptionSuccess() - `,
    timestampSetLocalDescriptionSuccess
  );
  setDescriptionSuccess(peerConnection, "setLocalDescription");
}

/** setRemoteDescriptionSuccess - Handles received remote success description */
function setRemoteDescriptionSuccess(peerConnection) {
  timestampSetRemoteDescriptionSuccess = new Date();
  updateAnalytics();
  console.log(
    `setRemoteDescriptionSuccess() - `,
    timestampSetRemoteDescriptionSuccess
  );
  setDescriptionSuccess(peerConnection, "setRemoteDescription");
}

/** setSessionDescriptionError - Handles session description error */
function setSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}.`);
}

/** handleLocalMediaStreamError - Handles media stream error */
function handleLocalMediaStreamError(error) {
  console.log(`navigator.getUserMedia error: ${error.toString()}.`);
}

/** handleConnectionChange - Handles connection change */
function handleConnectionChange(event) {
  console.log("ICE state change event: ", event);
  if (
    event != null &&
    event.currentTarget != null &&
    event.target.iceConnectionState == "connected"
  ) {
    if (timestampConnected == undefined) {
      timestampConnected = new Date();
      console.log(`connected - `, timestampConnected);
      updateAnalytics();
    }
  }
}

/** clearAnalytics - Clear analytics timestamps */
function clearAnalytics(cameraAnalyticsOnly = false) {
  console.log("Clearing analytics");

  if (!cameraAnalyticsOnly) {
    // Page launch
    timestampInitializeWebRTC = undefined;
    timestampStartLocalStream = undefined;
    timestampCreateSdpOffer = undefined;
    timestampCreateSdpOfferSuccess = undefined;
    timestampSetLocalDescription = undefined;
    timestampSetLocalDescriptionSuccess = undefined;
  }

  // Camera Stream button pressed
  timestampGenerateStreamRequest = undefined;
  timestampGenerateWebRtcStreamRequest = undefined;
  timestampGenerateStreamResponse = undefined;
  timestampExtendStreamRequest = undefined;
  timestampExtendWebRtcStreamRequest = undefined;
  timestampExtendStreamResponse = undefined;
  timestampStopStreamRequest = undefined;
  timestampStopWebRtcStreamRequest = undefined;
  timestampStopStreamResponse = undefined;
  timestampSetRemoteDescription = undefined;
  timestampSetRemoteDescriptionSuccess = undefined;
  timestampConnected = undefined;
  timestampPlaybackStarted = undefined;

  updateAnalytics();
}
