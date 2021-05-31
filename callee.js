let streamDoc, offers, offerDoc, answers, answerDoc;
const server = {
    iceServers: [{
        urls: "stun:stun.l.google.com:19302",
    }],
    iceCandidatePoolSize: 10,
};

const urlParams = new URLSearchParams(window.location.search);
const streamId = urlParams.get('streamId');
streamDoc = firebase.firestore().collection('streams').doc(streamId);
offers = streamDoc.collection('offers');
answers = streamDoc.collection('answers');


const remoteVideo = document.querySelector('#remoteVideo');


remoteVideo.onplay = async function () {
    // 1. JOINING THE STREAM
    const answerDoc = await streamDoc.collection("answers").add({ answer: null });
    answerDoc.collection("offer").onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                // 3. GET OFFER
                let data = change.doc.data();
                const offer = data.offer;

                // 4. SET LOCAL AND REMOTE DESCRIPTION
                const p = new RTCPeerConnection(server);
                const remoteStream = new MediaStream();
                p.ontrack = event => {
                    console.log("object")
                    event.streams[0].getTracks().forEach(track => {
                        console.log("object")
                        remoteStream.addTrack(track);
                    });
                };
                remoteVideo.srcObject = remoteStream;
                p.setRemoteDescription(new RTCSessionDescription(offer));
                const desc = await p.createAnswer();
                p.setLocalDescription(desc);
                console.log(desc)
                // 5. SEND ANSWER
                answerDoc.update({
                    "answer": {
                        sdp: desc.sdp,
                        type: desc.type
                    }
                });
                console.log(p.iceConnectionState);
                p.onicecandidate = async function (event) {
                    if (event.candidate) {
                        const answerCandidates = answerDoc.collection('answerCandidates');
                        await answerCandidates.add(event.candidate.toJSON());
                        console.log(">> REMOTE PEER ICECANDIDATE HAS BEEN SENT")
                    }
                };
                answerDoc.collection('offerCandidates').onSnapshot(snapshot => {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                            let data = change.doc.data();
                            p.addIceCandidate(new RTCIceCandidate(data));
                            console.log(">> FROM REMOTE PEER CONNECTION: local icecandidate has been added")

                        }
                    });
                });
                
            }
        });
    });



}