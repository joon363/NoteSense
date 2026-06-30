import cv2
import socketio
import time
import sys

# Optional: Try to import standard ML/computer vision libraries
try:
    import mediapipe as mp
except ImportError:
    print("[WARNING] 'mediapipe' not installed. Running in simulation mode.")
    print("To install: pip install mediapipe opencv-python python-socketio")
    mp = None

# Initialize Socket.io client to send tracked data to our Node.js server
sio = socketio.Client()

SERVER_URL = 'http://localhost:3000'

@sio.event
def connect():
    print(f"[INFO] Successfully connected to Node.js backend: {SERVER_URL}")
    # Register as an AI tracking helper
    sio.emit('register-device', 'ai_processor')

@sio.event
def disconnect():
    print("[INFO] Disconnected from backend server")

def run_tracking_pipeline():
    # Attempt connection to server
    try:
        sio.connect(SERVER_URL)
    except Exception as e:
        print(f"[ERROR] Could not connect to Socket server at {SERVER_URL}. Is node server.js running?")
        print("Continuing in local visualization mode (no network sending)...")

    # Start webcam capture
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Cannot access webcam.")
        sys.exit(1)

    print("[INFO] Starting hand keypoint tracking. Press 'q' to quit.")

    # Setup MediaPipe Hands if available
    if mp:
        mp_hands = mp.solutions.hands
        hands = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        mp_draw = mp.solutions.drawing_utils
    else:
        hands = None

    last_send_time = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[ERROR] Frame grab failed.")
            break

        # Flip horizontally for natural mirror view
        frame = cv2.flip(frame, 1)
        h, w, c = frame.shape

        # Run AI hand tracking inference
        if hands:
            # Convert BGR to RGB for MediaPipe inference
            img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(img_rgb)

            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    # Draw landmarks on the preview window
                    mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)
                    
                    # Extract INDEX_FINGER_TIP (Landmark Index 8)
                    index_finger_tip = hand_landmarks.landmark[8]
                    cx, cy = int(index_finger_tip.x * w), int(index_finger_tip.y * h)
                    
                    # Draw a bright glowing circle on the index finger tip
                    cv2.circle(frame, (cx, cy), 15, (254, 242, 0), -1) # Cyan in BGR (0, 242, 254)
                    cv2.putText(frame, "Index Tip (AI Tracked)", (cx + 20, cy), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

                    # Send tracking coordinates to Node.js backend every 100ms
                    now = time.time()
                    if sio.connected and (now - last_send_time > 0.1):
                        # Coordinates are normalized (0 to 1)
                        sio.emit('finger-coordinate-update', {
                            'x': index_finger_tip.x,
                            'y': index_finger_tip.y,
                            'detected': True
                        })
                        last_send_time = now
        else:
            # Draw simulation fallback banner
            cv2.putText(frame, "Simulation Mode: Install mediapipe to run AI", (20, 40), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            
            # Simulated circular hover track representing a finger in the middle
            sim_x, sim_y = int(w/2), int(h/2)
            cv2.circle(frame, (sim_x, sim_y), 10, (0, 255, 0), -1)

        # Show visualization window
        cv2.imshow("GalaxySync AI Tracker (Hugging Face / MediaPipe)", frame)

        # Quit key check
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    if sio.connected:
        sio.disconnect()

if __name__ == '__main__':
    run_tracking_pipeline()
