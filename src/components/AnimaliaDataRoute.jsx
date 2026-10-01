import { ScrollView, StyleSheet } from "react-native";
import AnimaliaLegacyDataPanel from "./AnimaliaLegacyDataPanel";

export default function AnimaliaDataRoute({ view, category, title, route }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AnimaliaLegacyDataPanel
        initialView={view}
        initialProcedureCategory={category}
        screenTitle={title}
        currentRoute={route}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F5F6FA",
    flex: 1,
  },
  content: {
    alignSelf: "center",
    maxWidth: 1100,
    padding: 16,
    width: "100%",
  },
});
