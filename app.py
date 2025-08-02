from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import pickle
import os
from werkzeug.utils import secure_filename
from sklearn.preprocessing import StandardScaler
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Load the trained model and scaler
try:
    with open('model.pkl', 'rb') as f:
        model = pickle.load(f)
    with open('scaler.pkl', 'rb') as f:
        scaler = pickle.load(f)
    print("Model and scaler loaded successfully!")
except FileNotFoundError:
    print("Model files not found. Please run the ML script first to generate model.pkl and scaler.pkl")
    model = None
    scaler = None

# Expected feature columns (30 features: Time + V1-V28 + Amount)
EXPECTED_COLUMNS = ['Time'] + [f'V{i}' for i in range(1, 29)] + ['Amount']

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict_manual', methods=['POST'])
def predict_manual():
    try:
        if model is None:
            return jsonify({'error': 'Model not loaded. Please check model files.'})
        
        # Get data from form
        data = request.json
        
        # Create feature array
        features = []
        features.append(float(data.get('time', 0)))  # Time
        
        # V1-V28 features
        for i in range(1, 29):
            features.append(float(data.get(f'v{i}', 0)))
        
        features.append(float(data.get('amount', 0)))  # Amount
        
        # Convert to numpy array and reshape
        features_array = np.array(features).reshape(1, -1)
        
        # Scale the features
        features_scaled = scaler.transform(features_array)
        
        # Make prediction
        prediction = model.predict(features_scaled)[0]
        probability = model.predict_proba(features_scaled)[0]
        
        # Convert numpy types to Python native types
        result = {
            'prediction': 'Fraud' if int(prediction) == 1 else 'Normal',
            'confidence': float(max(probability)) * 100,
            'fraud_probability': float(probability[1]) * 100,
            'normal_probability': float(probability[0]) * 100
        }
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/predict_csv', methods=['POST'])
def predict_csv():
    try:
        if model is None:
            return jsonify({'error': 'Model not loaded. Please check model files.'})
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'})
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'})
        
        if file and file.filename.endswith('.csv'):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # Read CSV file
            df = pd.read_csv(filepath)
            
            # Check if required columns exist
            missing_cols = [col for col in EXPECTED_COLUMNS if col not in df.columns]
            if missing_cols:
                os.remove(filepath)  # Clean up file before returning error
                return jsonify({'error': f'Missing columns: {missing_cols}'})
            
            # Select only the required columns in correct order
            df_features = df[EXPECTED_COLUMNS]
            
            # Check for missing or invalid values
            if df_features.isnull().any().any():
                os.remove(filepath)
                return jsonify({'error': 'CSV file contains missing values. Please ensure all fields are filled.'})
            
            # Scale the features
            features_scaled = scaler.transform(df_features)
            
            # Make predictions
            predictions = model.predict(features_scaled)
            probabilities = model.predict_proba(features_scaled)
            
            # Prepare results - Convert numpy types to Python native types
            results = []
            for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
                results.append({
                    'row': int(i + 1),
                    'prediction': 'Fraud' if int(pred) == 1 else 'Normal',
                    'fraud_probability': float(prob[1]) * 100,
                    'normal_probability': float(prob[0]) * 100
                })
            
            # Summary statistics - Convert numpy types to Python native types
            total_transactions = int(len(predictions))
            fraud_count = int(np.sum(predictions))  # Use np.sum to handle numpy array
            normal_count = total_transactions - fraud_count
            
            summary = {
                'total_transactions': total_transactions,
                'fraud_detected': fraud_count,
                'normal_transactions': normal_count,
                'fraud_percentage': float((fraud_count / total_transactions) * 100) if total_transactions > 0 else 0.0
            }
            
            # Clean up uploaded file
            os.remove(filepath)
            
            return jsonify({
                'results': results,
                'summary': summary
            })
        
        else:
            return jsonify({'error': 'Please upload a CSV file'})
    
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'})

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify the application is running"""
    model_status = 'loaded' if model is not None else 'not loaded'
    scaler_status = 'loaded' if scaler is not None else 'not loaded'
    
    return jsonify({
        'status': 'running',
        'model_status': model_status,
        'scaler_status': scaler_status
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
