import React, { useEffect, useState } from "react";
import { Text, View, StyleSheet, ActivityIndicator, Alert, Button, TextInput, TouchableOpacity, ScrollView } from "react-native";
import axios from "axios";

const API_BASE_URL = "http://192.168.0.104:8000"; // replace with your PC's IP

export default function App() {
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiAnswer, setAiAnswer] = useState(null);
  const [question, setQuestion] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);

  useEffect(() => {
    fetchLesson("english");
  }, []);

  const fetchLesson = (lang) => {
    setLoading(true);
    setError(null);
    setShowQuiz(false);
    axios.get(`${API_BASE_URL}/lesson/${lang}`)
      .then(res => {
        setLesson(res.data.lesson);
        setLoading(false);
        setAiAnswer(null);
        setQuiz(null);
        setCurrentQ(0);
        setScore(0);
      })
      .catch(() => {
        setLoading(false);
        setError("Could not load lesson");
      });
  };

  const fetchQuiz = (lang) => {
    axios.get(`${API_BASE_URL}/quiz/${lang}`)
      .then(res => {
        setQuiz(res.data.quiz);
        setShowQuiz(true);
        setCurrentQ(0);
        setScore(0);
      })
      .catch(() => Alert.alert("Error loading quiz"));
  };

  const handleAnswer = (option) => {
    if (quiz[currentQ].answer === option) {
      setScore(score + 1);
    }
    if (currentQ + 1 < quiz.length) {
      setCurrentQ(currentQ + 1);
    } else {
      Alert.alert("Quiz Finished", `Your Score: ${score + (quiz[currentQ].answer === option ? 1 : 0)} / ${quiz.length}`);
      setShowQuiz(false);
    }
  };

  const askAI = () => {
    if (!question.trim()) {
      Alert.alert("Enter a question first!");
      return;
    }
    axios.post(`${API_BASE_URL}/explain-ai/`, { question })
      .then(res => setAiAnswer(res.data.answer))
      .catch(() => setAiAnswer("AI request failed."));
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
      {!showQuiz ? (
        <>
          <Text style={styles.title}>{lesson?.title}</Text>
          <Text style={styles.content}>{lesson?.content}</Text>

          <View style={styles.row}>
            <Button title="English" onPress={() => fetchLesson("english")} />
            <Button title="Tamil" onPress={() => fetchLesson("tamil")} />
          </View>

          <Button title="Take Quiz" onPress={() => fetchQuiz(lesson.language.toLowerCase())} />

          <TextInput
            style={styles.input}
            placeholder="Ask AI about this lesson..."
            value={question}
            onChangeText={setQuestion}
          />
          <Button title="Ask AI" onPress={askAI} />

          {aiAnswer && (
            <Text style={styles.aiAnswer}>AI: {aiAnswer}</Text>
          )}
        </>
      ) : (
        <View style={styles.quizBox}>
          <Text style={styles.quizQ}>{quiz[currentQ].question}</Text>
          {quiz[currentQ].options.map((opt, idx) => (
            <TouchableOpacity key={idx} style={styles.optionBtn} onPress={() => handleAnswer(opt)}>
              <Text style={styles.optionText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.separator} />
      <Text style={styles.footer}>Connected via {API_BASE_URL}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 8, textAlign: "center" },
  content: { fontSize: 18, marginBottom: 20, textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "space-around", width: "100%", marginVertical: 10 },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, width: "100%", marginVertical: 10, borderRadius: 5 },
  aiAnswer: { marginTop: 20, fontSize: 16, color: "green", textAlign: "center" },
  separator: { height: 1, width: "80%", backgroundColor: "#e5e7eb", marginVertical: 20 },
  footer: { fontSize: 12, color: "#9ca3af", textAlign: "center" },
  loadingText: { marginTop: 10, fontSize: 16, color: "#007bff" },
  errorText: { fontSize: 20, fontWeight: "bold", color: "red", marginBottom: 10 },
  errorDetails: { textAlign: "center", color: "#4b5563" },
  quizBox: { marginTop: 20, width: "100%" },
  quizQ: { fontSize: 18, fontWeight: "600", marginBottom: 15, textAlign: "center" },
  optionBtn: { backgroundColor: "#e5e7eb", padding: 12, borderRadius: 6, marginVertical: 6 },
  optionText: { fontSize: 16, textAlign: "center" }
});

