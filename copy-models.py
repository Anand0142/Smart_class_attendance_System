import os
import shutil

def copy_models():
    # Source directory (Python backend models)
    src_dir = 'models'
    
    # Destination directory (React public models)
    dest_dir = '../smart-class-attendance/public/models'
    
    # Create destination directory if it doesn't exist
    if not os.path.exists(dest_dir):
        os.makedirs(dest_dir)
    
    # List of model files to copy
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
    
    # Copy each model file
    for file in model_files:
        src_path = os.path.join(src_dir, file)
        dest_path = os.path.join(dest_dir, file)
        
        if os.path.exists(src_path):
            print(f'Copying {file}...')
            shutil.copy2(src_path, dest_path)
            print(f'Successfully copied {file}')
        else:
            print(f'Warning: {file} not found in source directory')

if __name__ == '__main__':
    copy_models() 