import os
import cv2
import numpy as np
import face_recognition
import json
import urllib.request
from flask import Flask, request, jsonify
from flask_cors import CORS
import tempfile
import subprocess

app = Flask(__name__)
CORS(app)

def download_models():
    # Create models directory if it doesn't exist
    if not os.path.exists('models'):
        os.makedirs('models')

    # List of model files to download
    model_files = [
        'tiny_face_detector_model-weights_manifest.json',
        'tiny_face_detector_model-shard1',
        'face_landmark_68_model-weights_manifest.json',
        'face_landmark_68_model-shard1',
        'face_recognition_model-weights_manifest.json',
        'face_recognition_model-shard1',
        'face_recognition_model-shard2',
        'face_expression_model-weights_manifest.json',
        'face_expression_model-shard1'
    ]

    # Base URL for the models
    base_url = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/'

    # Download each model file
    for file in model_files:
        url = base_url + file
        save_path = os.path.join('models', file)
        print(f'Downloading {file}...')
        try:
            urllib.request.urlretrieve(url, save_path)
            print(f'Successfully downloaded {file}')
        except Exception as e:
            print(f'Error downloading {file}: {str(e)}')
            return False

    # Copy models to React public directory
    try:
        print("Copying models to React public directory...")
        subprocess.run(['python', 'copy-models.py'], check=True)
        print("Successfully copied models to React public directory")
    except Exception as e:
        print(f"Error copying models: {str(e)}")
        return False

    return True

def extract_face_features(image_file):
    try:
        # Save the uploaded file to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
            image_file.save(temp_file.name)
            temp_path = temp_file.name

        # Load image
        image = face_recognition.load_image_file(temp_path)
        
        # Find face locations
        face_locations = face_recognition.face_locations(image)
        
        if not face_locations:
            os.unlink(temp_path)  # Clean up temp file
            return None
        
        # Get face encodings
        face_encodings = face_recognition.face_encodings(image, face_locations)
        
        if not face_encodings:
            os.unlink(temp_path)  # Clean up temp file
            return None
        
        # Get face landmarks
        face_landmarks = face_recognition.face_landmarks(image, face_locations)
        
        # Get the first face
        face_encoding = face_encodings[0]
        face_landmark = face_landmarks[0]
        
        # Convert numpy array to list for JSON serialization
        face_encoding_list = face_encoding.tolist()
        
        # Clean up temp file
        os.unlink(temp_path)
        
        return {
            "face_encoding": face_encoding_list,
            "face_landmarks": face_landmark
        }
    except Exception as e:
        print(f"Error extracting features: {str(e)}")
        if 'temp_path' in locals():
            os.unlink(temp_path)  # Clean up temp file in case of error
        return None

@app.route('/extract-features', methods=['POST'])
def process_images():
    try:
        # Get image files from request
        if 'image1' not in request.files or 'image2' not in request.files:
            return jsonify({"error": "Both image files are required"}), 400
        
        image1_file = request.files['image1']
        image2_file = request.files['image2']
        
        # Extract features from both images
        features1 = extract_face_features(image1_file)
        features2 = extract_face_features(image2_file)
        
        if not features1 or not features2:
            return jsonify({"error": "No face detected in one or both images"}), 400
        
        # Convert lists back to numpy arrays for face distance calculation
        face_encoding1 = np.array(features1["face_encoding"])
        face_encoding2 = np.array(features2["face_encoding"])
        
        # Calculate face distance
        face_distance = face_recognition.face_distance([face_encoding1], face_encoding2)[0]
        
        return jsonify({
            "image1_features": features1,
            "image2_features": features2,
            "face_distance": float(face_distance)
        })
        
    except Exception as e:
        print(f"Error processing images: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Download models first
    if download_models():
        print("Models downloaded successfully")
        app.run(port=5000)
    else:
        print("Failed to download models") 