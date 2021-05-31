const vid = document.querySelector('#video');
const btn = document.querySelector('#btn');
btn.disabled = true;
const showId = document.querySelector('#showId');

const mediaConstraints = {
    'audio': { 'echoCancellation': true },
    'video': {
        width: { min: 640, ideal: 1366 },
        height: { min: 400, ideal: 768 },
        aspectRatio: 1.777777778,
        frameRate: { max: 60 },
        facingMode: "face"
    }
};
const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};
const server = {
    iceServers: [{
        urls: "stun:stun.l.google.com:19302",
    },
    ],
    iceCandidatePoolSize: 10,
};


const rtcPeers = [];
let stream, streamDoc;







const openMediaDevices = async (constraints) => {
    return navigator.mediaDevices.getUserMedia(constraints);
}




const start = async () => {
    const stream = await openMediaDevices(mediaConstraints);
    vid.srcObject = stream;
    btn.disabled = false;
    return stream;
}


async function createOffer(streamDoc, answerId, stream) {
    const answerDoc = streamDoc.collection("answers").doc(answerId);
    const p = new RTCPeerConnection(server);
    // Push tracks from local localStreamto peer connection
    stream.getTracks().forEach((track) => {
        p.addTrack(track, stream);
    });
    p.createOffer(offerOptions).then((desc) => {
        p.setLocalDescription(desc).then(async () => {
            console.log(">>> LOCAL PEER ADDED");
            const offer = {
                ...desc
            }
            await answerDoc.collection('offer').add({ offer });
        });
        
    });
    

    

    answerDoc.onSnapshot(async (snap) => {
        let answer = snap.data().answer;
        if (!p.currentRemoteDescription && answer) {
            const answerDescription = new RTCSessionDescription(answer);
            p.setRemoteDescription(answerDescription).then(() => {
                console.log(">>> REMOTE PEER DESCRIPTION ADDED")
            });
            
        }
    });


    answerDoc.collection('answerCandidates').onSnapshot(snapshot => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                let data = change.doc.data();
                p.addIceCandidate(new RTCIceCandidate(data)).then(() => {
                    console.log(">>> REMOTE PEER ICE CANDIDATE ADDED")
                });;
                
            }
        });
    });

    
    p.onicecandidate = async function (event) {
        console.log("object")
        if (event.candidate) {
            const offerCandidates = answerDoc.collection('offerCandidates');
            await offerCandidates.add(event.candidate.toJSON());
            console.log(">> REMOTE PEER ICECANDIDATE HAS BEEN SENT")
        }
    };
 
}


vid.onplay = async function () {
    // 1. OPEN USER MEDIA
    stream = await start();

    // 2. CREATE NEW ROOM
    streamDoc = await firebase.firestore().collection('streams').add({ exists: true });
    showId.innerHTML = streamDoc.id;

    streamDoc.collection("answers").onSnapshot(snapshot => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                // 3. SEND OFFER
                let answerId = change.doc.id;
                createOffer(streamDoc, answerId, stream)

            }
        });
    });
}

btn.onclick = () => {
    rtcPeers.forEach(p => {
        p.close()
    });
    stream.getTracks().forEach(async function(track) {
        if (track.readyState == 'live') {
            track.stop();
            btn.disabled = true;
            showId.innerHTML = '';
            await streamDoc.delete();
        }
    }); 
}