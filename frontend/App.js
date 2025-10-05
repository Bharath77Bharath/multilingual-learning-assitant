import React, { useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Button,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
  Dimensions,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_BASE_URL = "http://192.168.0.104:8000"; // replace with your PC's IP
const WIN_WIDTH = Dimensions.get("window").width;

export default function App() {
  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [aiInput, setAiInput] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [lastScore, setLastScore] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // animation refs per option: {qIndex: [Animated.Value, ...]}
  const animRefs = useRef({});

  useEffect(() => {
    (async () => {
      const savedLang = await AsyncStorage.getItem("lastLessonLang");
      const savedProgress = await AsyncStorage.getItem("progress");
      if (savedProgress) {
        setProgress(JSON.parse(savedProgress));
      }
      await fetchLesson(savedLang || "english");
    })();
  }, []);

  const ensureAnimRefs = (qIndex, optionsLength) => {
    if (!animRefs.current[qIndex]) {
      animRefs.current[qIndex] = Array.from({ length: optionsLength }, () => new Animated.Value(1));
    }
  };

  // Fetch lesson & quiz
  const fetchLesson = async (lang) => {
    setLoading(true);
    setError(null);
    setSelectedAnswers({});
    setAiAnswer("");
    try {
      const lessonRes = await axios.get(`${API_BASE_URL}/lesson/${lang}`);
      const quizRes = await axios.get(`${API_BASE_URL}/quiz/${lang}`);
      setLesson(lessonRes.data.lesson);
      setQuiz(quizRes.data.quiz || []);
      setSelectedAnswers({});
      setLoading(false);
      await AsyncStorage.setItem("lastLessonLang", lang);
      setLastScore(progress[lang]?.lastScore ?? null);
      // setup animation refs
      quizRes.data.quiz && quizRes.data.quiz.forEach((q, i) => ensureAnimRefs(i, q.options.length));
    } catch (err) {
      console.error("API Error:", err.message);
      setLoading(false);
      setError("Could not load lesson. Check backend & network.");
    }
  };

  const handleAnswerPress = (qIndex, optionIndex, optionText) => {
    // animate button press (scale)
    const anim = animRefs.current[qIndex][optionIndex];
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1.0, duration: 120, useNativeDriver: true }),
    ]).start();

    setSelectedAnswers((prev) => {
      const next = { ...prev, [qIndex]: optionText };
      return next;
    });
  };

  const handleSubmitQuiz = async () => {
    if (quiz.length === 0) {
      Alert.alert("No quiz available for this lesson.");
      return;
    }
    setSubmitting(true);
    let score = 0;
    quiz.forEach((q, i) => {
      if (selectedAnswers[i] && selectedAnswers[i] === q.answer) score++;
    });

    const langKey = lesson.language.toLowerCase();
    const newProgress = {
      ...progress,
      [langKey]: {
        lastScore: score,
        totalQuestions: quiz.length,
        completed: true,
        timestamp: Date.now(),
      },
    };

    setProgress(newProgress);
    await AsyncStorage.setItem("progress", JSON.stringify(newProgress));
    setLastScore(score);
    setSubmitting(false);
    setResultModalVisible(true);
  };

  const handleAskAI = async () => {
    if (!aiInput.trim()) {
      Alert.alert("Enter a question first!");
      return;
    }
    try {
      setAiAnswer("Thinking...");
      const res = await axios.post(`${API_BASE_URL}/explain-ai/`, {
        question: aiInput,
      });
      setAiAnswer(res.data.answer || "No response");
    } catch (err) {
      setAiAnswer("Error fetching AI response");
    }
  };

  // UI helpers
  const renderProgress = () => {
    if (!lesson) return null;
    const key = lesson.language.toLowerCase();
    const p = progress[key];
    if (!p) return <Text style={styles.noProgress}>No attempts yet for {key.toUpperCase()}</Text>;
    return (
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          Last: {p.lastScore}/{p.totalQuestions} • {p.completed ? "Completed" : "In progress"}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading lesson...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error</Text>
        <Text style={styles.errorDetails}>{error}</Text>
        <View style={{ height: 12 }} />
        <Button title="Retry" onPress={() => fetchLesson((lesson && lesson.language.toLowerCase()) || "english")} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>Multilingual Learning</Text>
        <Text style={styles.smallHint}>{lesson?.language} • {lesson?.title}</Text>
      </View>

      {/* Lesson */}
      <View style={styles.card}>
        <Text style={styles.lessonTitle}>{lesson?.title}</Text>
        <Text style={styles.lessonContent}>{lesson?.content}</Text>
        {renderProgress()}
        <View style={styles.langRow}>
          <Button title="English" onPress={() => fetchLesson("english")} />
          <Button title="Tamil" onPress={() => fetchLesson("tamil")} />
        </View>
      </View>

      {/* Quiz */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quiz</Text>
        {quiz.length === 0 ? (
          <Text style={styles.noProgress}>No quiz for this lesson.</Text>
        ) : (
          quiz.map((q, qi) => (
            <View key={qi} style={styles.quizCard}>
              <Text style={styles.quizQText}>{qi + 1}. {q.question}</Text>
              {q.options.map((opt, oi) => {
                ensureAnimRefs(qi, q.options.length);
                const anim = animRefs.current[qi][oi];
                // determine background for immediate feedback if selected
                const selected = selectedAnswers[qi] === opt;
                const isCorrect = selected && opt === q.answer;
                const isWrong = selected && opt !== q.answer;
                const bgColor = isCorrect ? "#16a34a" : isWrong ? "#ef4444" : "#F3F4F6";

                return (
                  <Animated.View
                    key={oi}
                    style={[styles.optionWrap, { transform: [{ scale: anim }] }]}
                  >
                    <Pressable
                      onPress={() => handleAnswerPress(qi, oi, opt)}
                      style={({ pressed }) => [
                        styles.optionBtn,
                        { backgroundColor: pressed ? "#e6eefc" : bgColor },
                        selected && styles.optionSelected,
                      ]}
                    >
                      <Text style={[styles.optionText, selected ? styles.optionTextSelected : null]}>
                        {opt}
                      </Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          ))
        )}
        <View style={styles.submitRow}>
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitQuiz} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Quiz</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* AI Assistant */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ask AI</Text>
        <TextInput
          style={styles.aiInput}
          placeholder="Ask a question about the lesson..."
          value={aiInput}
          onChangeText={setAiInput}
        />
        <View style={{ height: 8 }} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={styles.askBtn} onPress={handleAskAI}>
            <Text style={styles.askBtnText}>Ask AI</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearBtn} onPress={() => { setAiInput(""); setAiAnswer(""); }}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>
        {aiAnswer ? (
          <View style={styles.aiAnswerBox}>
            <Text style={styles.aiAnswerText}>{aiAnswer}</Text>
          </View>
        ) : null}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Connected via {API_BASE_URL}</Text>
      </View>

      {/* Result Modal */}
      <Modal
        visible={resultModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setResultModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Quiz Result</Text>
            <Text style={styles.modalScore}>
              Score: {lastScore ?? "—"} / {quiz.length}
            </Text>
            <View style={{ height: 12 }} />
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setResultModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
            <View style={{ height: 8 }} />
            <TouchableOpacity
              style={styles.modalContinue}
              onPress={() => { setResultModalVisible(false); }}
            >
              <Text style={styles.modalContinueText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 18,
    backgroundColor: "#FAFAFB",
    alignItems: "center",
  },
  header: { marginBottom: 10, alignItems: "center" },
  appTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  smallHint: { fontSize: 12, color: "#64748b", marginTop: 4 },

  card: {
    width: WIN_WIDTH - 36,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  lessonTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6, color: "#0f172a" },
  lessonContent: { fontSize: 15, color: "#334155", lineHeight: 22 },

  langRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  section: {
    width: WIN_WIDTH - 36,
    marginVertical: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, color: "#0f172a" },

  quizCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#eef2ff",
  },
  quizQText: { fontSize: 15, fontWeight: "600", marginBottom: 8, color: "#0f172a" },

  optionWrap: { marginVertical: 6 },
  optionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  optionText: { fontSize: 15, color: "#0f172a" },
  optionSelected: { borderWidth: 1, borderColor: "#c7d2fe" },

  submitRow: { alignItems: "center", marginTop: 6 },
  submitBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  submitText: { color: "#fff", fontWeight: "700" },

  aiInput: {
    backgroundColor: "#fff",
    width: WIN_WIDTH - 36,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e6edf8",
  },
  askBtn: {
    backgroundColor: "#0ea5e9",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  askBtnText: { color: "#fff", fontWeight: "700" },
  clearBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  clearBtnText: { color: "#334155", fontWeight: "600" },
  aiAnswerBox: {
    marginTop: 10,
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 8,
    width: WIN_WIDTH - 36,
  },
  aiAnswerText: { color: "#0f172a", fontSize: 15 },

  footer: { marginVertical: 16, alignItems: "center" },
  footerText: { color: "#94a3b8", fontSize: 12 },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  loadingText: { marginTop: 12, color: "#2563eb" },

  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 40 },
  errorText: { fontSize: 18, color: "#ef4444", fontWeight: "700" },
  errorDetails: { color: "#64748b", textAlign: "center", marginTop: 8 },

  progressRow: { marginTop: 12 },
  progressText: { color: "#2563eb", fontWeight: "700" },
  noProgress: { color: "#64748b", fontStyle: "italic" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(2,6,23,0.5)", justifyContent: "center", alignItems: "center" },
  modalCard: { width: WIN_WIDTH - 56, backgroundColor: "#fff", padding: 18, borderRadius: 12, alignItems: "center" },
  modalTitle: { fontSize: 20, fontWeight: "800" },
  modalScore: { fontSize: 28, fontWeight: "900", color: "#16a34a", marginTop: 8 },
  modalClose: { marginTop: 12, backgroundColor: "#e2e8f0", paddingVertical: 8, paddingHorizontal: 18, borderRadius: 8 },
  modalCloseText: { color: "#0f172a", fontWeight: "700" },
  modalContinue: { marginTop: 8, backgroundColor: "#2563eb", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalContinueText: { color: "#fff", fontWeight: "800" },
});
