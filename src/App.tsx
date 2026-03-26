import { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Plus, 
  History, 
  AlertTriangle, 
  MapPin, 
  Camera, 
  Mic, 
  Send,
  Wifi,
  WifiOff,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Stethoscope
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import WorldMap from './components/WorldMap';
import { generateOutbreakPDF } from './utils/pdfGenerator';
import { 
  savePatient, 
  getPatients, 
  saveDiagnosis, 
  getDiagnoses, 
  Patient, 
  Diagnosis 
} from './db';
import { diagnoseSymptoms, DiagnosisResult } from './services/diagnosisService';
import { getLocalDiagnosis } from './services/knowledgeBase';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

export default function App() {
  const [view, setView] = useState<'dashboard' | 'new-patient' | 'history' | 'outbreaks'>('dashboard');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(false);

  // Form State
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [audio, setAudio] = useState<string | null>(null);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    loadData();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadData = async () => {
    const p = await getPatients();
    const d = await getDiagnoses();
    setPatients(p);
    setDiagnoses(d);
  };

  const [audioRecording, setAudioRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        const reader = new FileReader();
        reader.onloadend = () => setAudio(reader.result as string);
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      setAudioRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && audioRecording) {
      mediaRecorderRef.current.stop();
      setAudioRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name: string }>({
    lat: -1.2921,
    lng: 36.8219,
    name: "Nairobi, Kenya"
  });
  const [pickingLocation, setPickingLocation] = useState(false);

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setSelectedLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            name: "My Current Location"
          });
          setPickingLocation(false);
          setLoading(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLoading(false);
          // Fallback
          setSelectedLocation({ lat: -1.2921, lng: 36.8219, name: "Nairobi, Kenya" });
          setPickingLocation(false);
        }
      );
    }
  };

  const handleDiagnose = async () => {
    if (!patientName || !patientAge || (!symptoms && !image && !audio)) return;
    setLoading(true);
    
    try {
      let result: DiagnosisResult | null = null;
      const symptomsText = symptoms || (image ? "Analyzing symptom from image..." : audio ? "Analyzing symptom from audio..." : "");
      
      if (isOnline) {
        try {
          result = await diagnoseSymptoms(
            symptomsText, 
            parseInt(patientAge), 
            selectedLocation, 
            image || undefined, 
            audio || undefined
          );
        } catch (e) {
          console.error("Online AI failed", e);
          result = getLocalDiagnosis(symptomsText) as any;
          if (result) {
            result.nearbyFacilities = [{ name: "Local Health Center", url: "#" }];
          }
        }
      } else {
        result = getLocalDiagnosis(symptomsText) as any;
        if (result) {
          result.nearbyFacilities = [{ name: "Local Health Center", url: "#" }];
        }
      }

      if (!result) {
        result = {
          conditions: ["General Consultation Required"],
          riskLevel: "Medium",
          recommendations: ["Monitor symptoms", "Consult a health worker"],
          nearbyFacilities: [{ name: "Local Health Center", url: "#" }]
        };
      }

      setDiagnosisResult(result);

      const newPatient: Patient = {
        id: crypto.randomUUID(),
        name: patientName,
        age: parseInt(patientAge),
        gender: 'Unknown',
        location: selectedLocation,
        createdAt: Date.now()
      };

      const newDiagnosis: Diagnosis = {
        id: crypto.randomUUID(),
        patientId: newPatient.id,
        symptoms: symptomsText,
        prediction: result as any,
        synced: false,
        createdAt: Date.now()
      };

      await savePatient(newPatient);
      await saveDiagnosis(newDiagnosis);
      await loadData();
      
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPatientName('');
    setPatientAge('');
    setSymptoms('');
    setImage(null);
    setAudio(null);
    setAudioBlob(null);
    setDiagnosisResult(null);
    setSelectedLocation({ lat: -1.2921, lng: 36.8219, name: "Nairobi, Kenya" });
    setView('dashboard');
  };

  const mapMarkers: any[] = [
    { id: 1, lat: -1.2921, lng: 36.8219, type: 'High', count: 12 },
    { id: 2, lat: 6.5244, lng: 3.3792, type: 'Medium', count: 5 },
    { id: 3, lat: -26.2041, lng: 28.0473, type: 'Low', count: 8 },
    { id: 4, lat: 30.0444, lng: 31.2357, type: 'Medium', count: 15 },
    { id: 5, lat: 51.5074, lng: -0.1278, type: 'Low', count: 3 },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <Stethoscope className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">HealthAssist AI</h1>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${isOnline ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isOnline ? 'bg-green-500' : 'bg-orange-500'}`} />
          {isOnline ? 'Online' : 'Offline'}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 pb-24">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => setView('new-patient')}
                  className="group bg-blue-600 text-white p-8 rounded-3xl flex flex-col items-start gap-6 hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 relative overflow-hidden"
                >
                  <div className="bg-white/20 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                    <Plus className="w-8 h-8" />
                  </div>
                  <div className="text-left z-10">
                    <h3 className="text-2xl font-bold mb-1">New Diagnosis</h3>
                    <p className="text-blue-100 text-sm opacity-80">Multimodal patient assessment</p>
                  </div>
                  <Activity className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 rotate-12" />
                </button>
                <button 
                  onClick={() => setView('outbreaks')}
                  className="group bg-white border border-gray-200 p-8 rounded-3xl flex flex-col items-start gap-6 hover:border-blue-400 hover:shadow-xl transition-all relative overflow-hidden"
                >
                  <div className="bg-orange-100 p-4 rounded-2xl text-orange-600 group-hover:scale-110 transition-transform">
                    <MapPin className="w-8 h-8" />
                  </div>
                  <div className="text-left z-10">
                    <h3 className="text-2xl font-bold mb-1 text-gray-900">Health Map</h3>
                    <p className="text-gray-500 text-sm">Real-time outbreak detection</p>
                  </div>
                  <AlertTriangle className="absolute -right-4 -bottom-4 w-32 h-32 text-gray-50 rotate-12" />
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="font-bold text-xl text-gray-900">Recent Activity</h3>
                    <p className="text-sm text-gray-500">Latest 3 patient assessments</p>
                  </div>
                  <button onClick={() => setView('history')} className="bg-gray-50 px-4 py-2 rounded-xl text-blue-600 text-sm font-bold flex items-center gap-1 hover:bg-blue-50 transition-colors">
                    History <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-4">
                  {diagnoses.slice(0, 3).map((d) => {
                    const patient = patients.find(p => p.id === d.patientId);
                    return (
                      <div key={d.id} className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors">
                        <div className="flex items-center gap-5">
                          <div className={`w-3 h-3 rounded-full shadow-sm ${d.prediction.riskLevel === 'High' ? 'bg-red-500' : d.prediction.riskLevel === 'Medium' ? 'bg-orange-500' : 'bg-green-500'}`} />
                          <div>
                            <p className="font-bold text-gray-900">{patient?.name || 'Unknown'}</p>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{d.prediction.conditions[0]}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-gray-400">{new Date(d.createdAt).toLocaleDateString()}</p>
                          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">{d.prediction.riskLevel} Risk</p>
                        </div>
                      </div>
                    );
                  })}
                  {diagnoses.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <History className="w-10 h-10 opacity-20" />
                      </div>
                      <p className="font-medium">No recent activity found</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'new-patient' && (
            <motion.div 
              key="new-patient"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white border border-gray-200 rounded-3xl p-8 space-y-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <button onClick={() => setView('dashboard')} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <ChevronRight className="w-6 h-6 rotate-180" />
                  </button>
                  <div>
                    <h3 className="font-bold text-2xl text-gray-900">Patient Assessment</h3>
                    <p className="text-sm text-gray-500">Multimodal symptom capture</p>
                  </div>
                </div>

                {!diagnosisResult ? (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Patient Name</label>
                        <input 
                          type="text" 
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          placeholder="Full Name"
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Age</label>
                        <input 
                          type="number" 
                          value={patientAge}
                          onChange={(e) => setPatientAge(e.target.value)}
                          placeholder="Years"
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Location</label>
                      <button 
                        onClick={() => setPickingLocation(true)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 flex items-center justify-between hover:border-blue-300 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <MapPin className="w-5 h-5 text-blue-600" />
                          <span className="font-medium text-gray-700">{selectedLocation.name}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Symptoms (Text, Photo, or Audio)</label>
                      <div className="relative">
                        <textarea 
                          value={symptoms}
                          onChange={(e) => setSymptoms(e.target.value)}
                          placeholder="Describe symptoms or use multimodal inputs below..."
                          rows={4}
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium resize-none"
                        />
                        <div className="absolute bottom-4 right-4 flex gap-2">
                          {image && <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-lg"><Camera className="w-4 h-4" /></div>}
                          {audio && <div className="bg-red-600 text-white p-1.5 rounded-lg shadow-lg"><Mic className="w-4 h-4" /></div>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <label className={`flex flex-col items-center justify-center gap-3 py-6 rounded-2xl font-bold transition-all cursor-pointer border-2 border-dashed ${image ? 'bg-blue-50 border-blue-400 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-blue-300'}`}>
                        <Camera className="w-8 h-8" />
                        <span className="text-sm">{image ? 'Photo Captured' : 'Add Photo'}</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setImage(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      <button 
                        onClick={audioRecording ? stopRecording : startRecording}
                        className={`flex flex-col items-center justify-center gap-3 py-6 rounded-2xl font-bold transition-all border-2 border-dashed ${audioRecording ? 'bg-red-50 border-red-400 text-red-600 animate-pulse' : audio ? 'bg-green-50 border-green-400 text-green-600' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-red-300'}`}
                      >
                        <Mic className="w-8 h-8" />
                        <span className="text-sm">
                          {audioRecording ? 'Recording...' : audio ? 'Audio Recorded' : 'Record Audio'}
                        </span>
                      </button>
                    </div>

                    <button 
                      onClick={handleDiagnose}
                      disabled={loading || !patientName || !patientAge || (!symptoms && !image && !audio)}
                      className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all text-lg"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                      Run AI Diagnosis
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className={`p-8 rounded-3xl shadow-lg ${diagnosisResult.riskLevel === 'High' ? 'bg-red-600 text-white' : diagnosisResult.riskLevel === 'Medium' ? 'bg-orange-500 text-white' : 'bg-green-600 text-white'}`}>
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="font-bold text-2xl">Assessment Result</h4>
                        <span className="px-4 py-1.5 rounded-full bg-white/20 text-xs font-bold uppercase tracking-widest border border-white/30">
                          {diagnosisResult.riskLevel} Risk
                        </span>
                      </div>
                      <div className="space-y-3">
                        <p className="text-xs font-bold opacity-70 uppercase tracking-widest">Primary Conditions</p>
                        <div className="flex flex-wrap gap-2">
                          {diagnosisResult.conditions.map(c => (
                            <span key={c} className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl font-bold text-sm border border-white/10">{c}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h5 className="font-bold text-lg flex items-center gap-3 text-gray-900">
                          <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          Recommended Actions
                        </h5>
                        <ul className="space-y-3">
                          {diagnosisResult.recommendations.map((r, i) => (
                            <li key={i} className="bg-gray-50 p-4 rounded-2xl text-sm font-medium border border-gray-100 text-gray-700">{r}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-4">
                        <h5 className="font-bold text-lg flex items-center gap-3 text-gray-900">
                          <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                            <MapPin className="w-5 h-5" />
                          </div>
                          Nearby Facilities
                        </h5>
                        <div className="grid grid-cols-1 gap-3">
                          {diagnosisResult.nearbyFacilities.map(f => (
                            <a 
                              key={f.name} 
                              href={f.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="bg-white border border-gray-100 p-4 rounded-2xl flex items-center justify-between hover:border-blue-300 hover:bg-blue-50 transition-all group shadow-sm"
                            >
                              <div className="flex items-center gap-4">
                                <div className="bg-blue-50 p-2 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                  <MapPin className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{f.name}</p>
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Available for treatment</p>
                                </div>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" />
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={resetForm}
                      className="w-full bg-gray-900 text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-gray-200"
                    >
                      Complete Assessment
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {pickingLocation && (
            <motion.div 
              key="location-picker"
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              className="fixed inset-0 z-[70] bg-[#F8F9FA] flex flex-col"
            >
              {/* Google Maps Style Header */}
              <div className="absolute top-6 left-6 right-6 z-20">
                <div className="bg-white shadow-2xl rounded-2xl p-4 flex items-center gap-3 border border-gray-100">
                  <button onClick={() => setPickingLocation(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <ChevronRight className="w-6 h-6 rotate-180" />
                  </button>
                  <div className="flex-1 flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <input 
                      type="text" 
                      value={selectedLocation.name}
                      onChange={(e) => setSelectedLocation({ ...selectedLocation, name: e.target.value })}
                      placeholder="Search for a location..."
                      className="flex-1 font-medium focus:outline-none text-gray-900"
                    />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                    R
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-[#E5E3DF] relative overflow-hidden">
                {/* Simulated Map Background with more detail */}
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                
                {/* Simulated Roads */}
                <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
                  <path d="M0,200 L1000,200 M0,400 L1000,400 M200,0 L200,1000 M400,0 L400,1000" fill="none" stroke="#fff" strokeWidth="40" />
                  <path d="M0,200 L1000,200 M0,400 L1000,400 M200,0 L200,1000 M400,0 L400,1000" fill="none" stroke="#D1D1D1" strokeWidth="2" />
                </svg>

                {/* Buildings/Blocks */}
                <div className="absolute top-[220px] left-[220px] w-32 h-32 bg-white/40 rounded-lg border border-gray-300" />
                <div className="absolute top-[420px] left-[420px] w-48 h-24 bg-white/40 rounded-lg border border-gray-300" />
                <div className="absolute top-[100px] left-[450px] w-24 h-48 bg-white/40 rounded-lg border border-gray-300" />

                {/* Center Pin */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative">
                    <motion.div 
                      animate={{ y: [0, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      <MapPin className="w-12 h-12 text-red-600 drop-shadow-2xl" />
                    </motion.div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1.5 bg-black/20 rounded-full blur-[3px]" />
                  </div>
                </div>

                {/* Floating Action Buttons */}
                <div className="absolute bottom-32 right-6 flex flex-col gap-3">
                  <button 
                    onClick={useCurrentLocation}
                    className="bg-white p-4 rounded-2xl shadow-xl border border-gray-100 text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <MapPin className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Bottom Sheet */}
              <div className="bg-white rounded-t-[40px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.1)] p-8 space-y-6 relative z-10">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-2" />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-2xl font-bold text-gray-900">{selectedLocation.name}</h4>
                    <p className="text-sm text-gray-500">{selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}</p>
                  </div>
                  <button 
                    onClick={() => setPickingLocation(false)}
                    className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                  >
                    Confirm Location
                  </button>
                </div>
                
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                  <div className="flex-shrink-0 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm font-bold text-gray-700">Safe Zone</span>
                  </div>
                  <div className="flex-shrink-0 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-gray-700">3 Nearby Clinics</span>
                  </div>
                  <div className="flex-shrink-0 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-bold text-gray-700">Low Outbreak Risk</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'outbreaks' && (
            <motion.div 
              key="outbreaks"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-[#F8F9FA] flex flex-col"
            >
              {/* Google Maps Style Header */}
              <div className="absolute top-6 left-6 right-6 z-20">
                <div className="bg-white shadow-2xl rounded-2xl p-4 flex items-center gap-3 border border-gray-100">
                  <button onClick={() => setView('dashboard')} className="p-1 hover:bg-gray-100 rounded-lg">
                    <ChevronRight className="w-6 h-6 rotate-180" />
                  </button>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Health Map</p>
                    <p className="font-bold text-gray-900">Regional Outbreak Monitor</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="bg-blue-600 text-white p-2 rounded-xl">
                      <Activity className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Map Background */}
              <div className="flex-1 bg-blue-50/30 relative overflow-hidden">
                <WorldMap markers={mapMarkers} />
                
                {/* Legend */}
                <div className="absolute top-28 right-6 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-gray-100 space-y-3 z-20">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-600" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">High Risk</span>
                  </div>
                  <div 
                    className="flex items-center gap-3"
                  >
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Medium Risk</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-600" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Low Risk</span>
                  </div>
                </div>
              </div>

              {/* Bottom Sheet */}
              <div className="bg-white rounded-t-[40px] shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.1)] p-8 space-y-6 relative z-10">
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-2" />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-2xl font-bold text-gray-900">Regional Insights</h4>
                    <p className="text-sm text-gray-500">Nairobi Metropolitan Area</p>
                  </div>
                  <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-2xl font-bold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Critical Alert
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Fever', count: 24, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Cough', count: 18, color: 'text-orange-600', bg: 'bg-orange-50' },
                    { label: 'Diarrhea', count: 7, color: 'text-blue-600', bg: 'bg-blue-50' }
                  ].map(stat => (
                    <div key={stat.label} className={`${stat.bg} p-4 rounded-2xl border border-gray-100 transition-transform hover:scale-105`}>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nearby Health Facilities</h5>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                          <Stethoscope className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Nairobi Hospital</p>
                          <p className="text-xs text-gray-500">2.4 km away • Open 24h</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="bg-green-100 p-2 rounded-xl text-green-600">
                          <Plus className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Kenyatta Pharmacy</p>
                          <p className="text-xs text-gray-500">0.8 km away • Closes 9 PM</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300" />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => generateOutbreakPDF(diagnoses, mapMarkers)}
                  className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-blue-100 flex items-center justify-center gap-3 hover:bg-blue-700 transition-colors"
                >
                  <Activity className="w-6 h-6" />
                  Download Outbreak Analysis (PDF)
                </button>
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setView('dashboard')} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <ChevronRight className="w-6 h-6 rotate-180" />
                </button>
                <h3 className="font-bold text-2xl text-gray-900">Diagnosis History</h3>
              </div>
              
              <div className="space-y-3">
                {diagnoses.map((d) => {
                  const patient = patients.find(p => p.id === d.patientId);
                  return (
                    <div key={d.id} className="bg-white border border-gray-200 p-5 rounded-2xl flex items-center justify-between hover:border-blue-200 transition-all shadow-sm">
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${d.prediction.riskLevel === 'High' ? 'bg-red-100 text-red-600' : d.prediction.riskLevel === 'Medium' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                          <Activity className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{patient?.name}</p>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{d.prediction.conditions.join(', ')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-400">{new Date(d.createdAt).toLocaleDateString()}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${d.synced ? 'text-green-500' : 'text-gray-300'}`}>
                          {d.synced ? 'Cloud Synced' : 'Local Only'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-200 px-8 py-4 flex justify-around items-center z-50">
        <button onClick={() => setView('dashboard')} className={`p-3 rounded-2xl transition-all ${view === 'dashboard' ? 'text-blue-600 bg-blue-50 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
          <Activity className="w-7 h-7" />
        </button>
        <button onClick={() => setView('new-patient')} className={`p-3 rounded-2xl transition-all ${view === 'new-patient' ? 'text-blue-600 bg-blue-50 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
          <Plus className="w-7 h-7" />
        </button>
        <button onClick={() => setView('outbreaks')} className={`p-3 rounded-2xl transition-all ${view === 'outbreaks' ? 'text-blue-600 bg-blue-50 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
          <MapPin className="w-7 h-7" />
        </button>
        <button onClick={() => setView('history')} className={`p-3 rounded-2xl transition-all ${view === 'history' ? 'text-blue-600 bg-blue-50 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
          <History className="w-7 h-7" />
        </button>
      </nav>
    </div>
  );
}
