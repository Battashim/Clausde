import React, { useEffect, useState } from "react";
import { SafeAreaView, StatusBar } from "react-native";
import type { EpisodeBundle } from "./src/api";
import { mixer } from "./src/audio/mixer";
import { initVoices } from "./src/audio/voices";
import { HomeScreen } from "./src/screens/HomeScreen";
import { NotebookScreen } from "./src/screens/NotebookScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { SessionScreen } from "./src/session/SessionScreen";
import { colors } from "./src/theme";

type Route = { name: "home" } | { name: "session"; bundle: EpisodeBundle; offline: boolean } | { name: "notebook" } | { name: "settings" };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([mixer.init(), initVoices()]).finally(() => setReady(true));
    return () => mixer.dispose();
  }, []);

  const home = () => setRoute({ name: "home" });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="dark-content" />
      {!ready ? null : route.name === "session" ? (
        <SessionScreen bundle={route.bundle} offline={route.offline} onExit={home} />
      ) : route.name === "notebook" ? (
        <NotebookScreen onBack={home} />
      ) : route.name === "settings" ? (
        <SettingsScreen onBack={home} />
      ) : (
        <HomeScreen onPlay={(bundle, offline) => setRoute({ name: "session", bundle, offline })} onNotebook={() => setRoute({ name: "notebook" })} onSettings={() => setRoute({ name: "settings" })} />
      )}
    </SafeAreaView>
  );
}
