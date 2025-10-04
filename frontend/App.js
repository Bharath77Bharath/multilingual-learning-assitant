import React, { useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Button,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_BASE_URL = "http://192.168.0.104:8000"; // replace with your PC's IP

export default function App() {
  const [lesson, setLesson] = useState(null);
  const [quiz, setQuiz] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [aiInput, setAiInput] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load last lesson + progress from storage
  useEffect(() => {
    (async () => {
      const savedLang = await AsyncStorage.getItem("lastLessonLang");
      const savedProgress = await AsyncStorage.getItem("progress");
      if (savedProgress) {
        setProgress(JSON.parse(savedProgress));
      }
      fetchLesson(savedLang || "english");
    })();
  }, []);

  // Fetch lesson & quiz
  const fetchLesson = async (lang) => {
    setLoading(true);
    setError(null);
    try {
      const lessonRes = await axios.get(`${API_BASE_URL}/lesson/${lang}`);
      const quizRes = await axios.get(`${API_BASE_URL}/quiz/${lang}`);
      setLesson(lessonRes.data.lesson);
      setQuiz(quizRes.data.quiz);
      setSelectedAnswers({});
      setLoading(false);
      await AsyncStorage.setItem("lastLessonLang", lang);
    } catch (err) {
      console.error("API Error:", err.message);
      setLoading(false);
      setError("Could not load lesson");
    }
  };

  // Handle quiz answer selection
  const handleAnswer = (qIndex, option) => {
    setSelectedAnswers((prev) => ({ ...prev, [qIndex]: option }));
  };

  // Submit quiz
  const handleSubmitQuiz = async () => {
    let score = 0;
    quiz.forEach((q, i) => {
      if (selectedAnswers[i] === q.answer) score++;
    });

    const langKey = lesson.language.toLowerCase();

    const newProgress = {
      ...progress,
      [langKey]: {
        lastScore: score,
        totalQuestions: quiz.length,
        completed: true,
      },
    };

    setProgress(newProgress);
    await AsyncStorage.setItem("progress", JSON.stringify(newProgress));

    Alert.alert("Quiz Finished", `You scored ${score} / ${quiz.length}`);
  };

  // Submit AI query
  const handleAskAI = async () => {
    if (!aiInput.trim()) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/explain-ai/`, {
        question: aiInput,
      });
      setAiAnswer(res.data.answer || "No response");
    } catch (err) {
      setAiAnswer("Error fetching AI response");
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading lesson...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error Loading Lesson</Text>
        <Text style={styles.errorDetails}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{lesson?.title}</Text>
      <Text style={styles.content}>{lesson?.content}</Text>

      {/* Language Switch */}
      <View style={styles.row}>
        <Button title="English" onPress={() => fetchLesson("english")} />
        <Button title="Tamil" onPress={() => fetchLesson("tamil")} />
      </View>

      {/* Progress Section */}
      <Text style={styles.sectionTitle}>Your Progress</Text>
      {Object.keys(progress).length === 0 ? (
        <Text style={styles.noProgress}>No progress yet</Text>
      ) : (
        Object.entries(progress).map(([lang, data], i) => (
          <Text key={i} style={styles.progressText}>
            {lang.toUpperCase()} → {data.completed ? `Score: ${data.lastScore}/${data.totalQuestions}` : "Not completed"}
          </Text>
        ))
      )}

      {/* Quiz Section */}
      <Text style={styles.sectionTitle}>Quiz</Text>
      {quiz.map((q, i) => (
        <View key={i} style={styles.quizBox}>
          <Text style={styles.quizQuestion}>{q.question}</Text>
          {q.options.map((opt, j) => (
            <TouchableOpacity
              key={j}
              style={[
                styles.optionButton,
                selectedAnswers[i] === opt && {
                  backgroundColor: opt === q.answer ? "#4CAF50" : "#F87171",
                },
              ]}
              onPress={() => handleAnswer(i, opt)}
            >
              <Text style={styles.optionText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      {quiz.length > 0 && (
        <Button title="Submit Quiz" onPress={handleSubmitQuiz} />
      )}

      {/* AI Assistant */}
      <Text style={styles.sectionTitle}>Ask AI</Text>
      <TextInput
        style={styles.input}
        placeholder="Ask a question..."
        value={aiInput}
        onChangeText={setAiInput}
      />
      <Button title="Ask AI" onPress={handleAskAI} />
      {aiAnswer ? <Text style={styles.aiAnswer}>{aiAnswer}</Text> : null}

      {/* Footer */}
      <View style={styles.separator} />
      <Text style={styles.footer}>Connected via {API_BASE_URL}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  content: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginVertical: 10,
  },
  quizBox: {
    marginBottom: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    width: "100%",
  },
  quizQuestion: {
    fontSize: 16,
    marginBottom: 8,
  },
  optionButton: {
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },
  optionText: {
    fontSize: 16,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    width: "100%",
    marginBottom: 10,
  },
  aiAnswer: {
    marginTop: 10,
    fontSize: 16,
    color: "#2563eb",
    textAlign: "center",
  },
  progressText: {
    fontSize: 16,
    marginVertical: 4,
    color: "#374151",
  },
  noProgress: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#9ca3af",
  },
  separator: {
    height: 1,
    width: "80%",
    backgroundColor: "#e5e7eb",
    marginVertical: 20,
  },
  footer: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#007bff",
  },
  errorText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "red",
    marginBottom: 10,
  },
  errorDetails: {
    textAlign: "center",
    color: "#4b5563",
  },
});
