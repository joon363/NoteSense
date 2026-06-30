# GalaxySync AI Hand Tracking Guide (Hugging Face / Python)

본 폴더는 **AR Glass PoC**의 핵심 기술인 **1인칭 손가락 끝 검출(Finger Keypoint Detection)**을 Python 백엔드 환경에서 Hugging Face 오픈소스 모델 또는 컴퓨터 비전 라이브러리를 사용해 구동하는 방법을 안내합니다.

---

## 1. AI 핵심 아키텍처 비교

이 PoC 프로젝트는 2가지 방식으로 손가락 인식을 구현할 수 있습니다.

### 방법 A: 브라우저 실시간 추적 (PoC 기본 적용)
* **방식:** 휴대폰 웹 브라우저 자체에서 WebAssembly(WASM) 및 WebGL을 사용해 **MediaPipe Hands**로 추적.
* **장점:** 카메라 영상을 서버로 보낼 때 생기는 Wi-Fi 레이턴시(지연 시간)가 전혀 없으며, 30fps로 매우 매끄럽게 동작. 별도의 AI 서버(GPU)가 필요 없음.
* **사용법:** `#phone` 뷰를 스마트폰으로 열면 즉시 프론트엔드 내에서 손가락 끝이 추적됩니다.

### 방법 B: Python AI 서버 추적 (본 가이드라인)
* **방식:** 휴대폰이 카메라 화면을 WebSocket 스트림으로 노트북(Python)으로 전송하고, 노트북의 Python 모델(Hugging Face 또는 PyTorch)이 이를 해석하여 결과를 프론트엔드에 다시 보냅니다.
* **장점:** Hugging Face의 무거운 고정밀 AI 모델(YOLOv8-Pose, RT-DETR 등)을 마음껏 활용하여 복잡한 환경에서도 손가락 인식이 가능함.

---

## 2. Python 환경 구축 및 패키지 설치

Python 3.8 이상 환경에서 다음 패키지를 설치합니다.

```bash
# 기본 필요한 패키지 설치
pip install opencv-python python-socketio mediapipe

# Hugging Face 모델 연동을 원할 시 (YOLOv8 Pose 기반)
pip install ultralytics huggingface_hub
```

---

## 3. Hugging Face 추천 모델 리스트

Hugging Face Hub에서 다운로드받아 `detect.py`에 적용할 수 있는 고성능 손 검출/키포인트 모델들입니다:

1. **YOLOv8 Pose Hand (추천):**
   * 모델: [Bingsu/adetailer](https://huggingface.co/Bingsu/adetailer) 내의 `hand_yolov8n.pt` 또는 `yolov8n-pose` 기반 모델.
   * 용도: 검지 손가락 끝(INDEX_FINGER_TIP) 좌표를 초고속(100fps+)으로 검출합니다.
   * 코드 예시:
     ```python
     from ultralytics import YOLO
     # Hugging Face 허브에서 다운로드받은 포즈 모델 로드
     model = YOLO('yolov8n-pose.pt') 
     results = model('camera_frame.jpg')
     # Keypoints 중 손끝 위치 추출
     ```

2. **DEtection TRansformer (DETR) for Keypoints:**
   * 모델 카테고리: `keypoint-detection` 태스크 필터링.
   * `facebook/detr-resnet-50` 또는 유사의 Keypoint 헤더 모델을 통해 손 모양 랜드마크 추출 가능.

---

## 4. 파이썬 AI 추적 실행 방법

1. 먼저 Node.js 백엔드 서버를 켭니다:
   ```bash
   npm run server
   ```
2. Python 스크립트를 구동하여 웹캠 또는 비디오 스트림에서 손가락 추적을 활성화합니다:
   ```bash
   python detect.py
   ```
3. 스크립트가 실행되면 웹캠 화면에 사용자의 검지 손가락 끝에 **하늘색 원**이 표시되며, 실시간으로 좌표가 Node.js 웹소켓 서버로 브로드캐스트됩니다.
4. 이 좌표 데이터를 수신한 노트북 웹 에디터(`Editor.jsx`)와 스마트폰 AR 화면(`PhoneAR.jsx`)은 1인칭 가리키기 동작을 화면 상에 실시간 렌더링할 수 있게 됩니다.
