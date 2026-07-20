export interface FaceValidationResult {
  isValid: boolean;
  faceDetected: boolean;
  multipleFaces: boolean;
  confidenceScore: number;
  livenessScore: number;
  antiSpoofingPassed: boolean;
  quality: {
    illumination: number;
    blur: number;
    pose: number;
    occlusion: number;
  };
  reason?: string;
}

export interface LivenessResult {
  passed: boolean;
  score: number;
  method: "blink" | "head_movement" | "depth" | "challenge_response";
  details?: string;
}

export interface FaceEmbedding {
  id: string;
  vector: number[];
  modelVersion: string;
  createdAt: string;
}

export interface FaceComparisonResult {
  match: boolean;
  confidenceScore: number;
  threshold: number;
  distance: number;
}

export interface IFaceService {
  validateFace(imageData: string): Promise<FaceValidationResult>;
  detectLiveness(imageData: string): Promise<LivenessResult>;
  compareFace(embedding1: number[], embedding2: number[]): Promise<FaceComparisonResult>;
  registerFaceEmbedding(imageData: string): Promise<FaceEmbedding>;
  getValidationScore(imageData: string): Promise<number>;
}
