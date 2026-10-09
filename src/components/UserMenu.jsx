import { Link } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLogout } from '../hooks/use-logout';
import { useAnimaliaData } from '../store/AnimaliaDataContext';

/** Avatar do usuário no cabeçalho: mostra quem está logado e permite sair ou trocar de usuário. */
export default function UserMenu() {
  const { session } = useAnimaliaData();
  const logout = useLogout();
  const [open, setOpen] = useState(false);

  if (!session) {
    return (
      <Link href="/Login" asChild>
        <Pressable style={styles.loginButton}>
          <Text style={styles.loginButtonText}>Entrar</Text>
        </Pressable>
      </Link>
    );
  }

  const email = session.user.email ?? '';
  const initial = email.charAt(0).toUpperCase() || '?';

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Conta de ${email}`}
        style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.avatarText}>{initial}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            <View style={styles.menuHeader}>
              <View style={[styles.avatar, styles.avatarLarge]}>
                <Text style={[styles.avatarText, { fontSize: 18 }]}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>Conectado como</Text>
                <Text style={styles.menuEmail} numberOfLines={1}>{email}</Text>
              </View>
            </View>
            <Pressable onPress={handleLogout} style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
              <Text style={styles.menuItemText}>Entrar com outro usuário</Text>
            </Pressable>
            <Pressable onPress={handleLogout} style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
              <Text style={[styles.menuItemText, { color: '#E11D48' }]}>Sair</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00A86B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  avatarLarge: { width: 44, height: 44, borderRadius: 22, borderColor: '#E2E8F0' },
  avatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  loginButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  loginButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  backdrop: { flex: 1, alignItems: 'flex-end', paddingTop: 100, paddingHorizontal: 16 },
  menu: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    boxShadow: '0px 8px 24px rgba(15, 23, 42, 0.18)',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 4,
  },
  menuLabel: { fontSize: 12, color: '#64748B' },
  menuEmail: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  menuItem: { paddingVertical: 11, paddingHorizontal: 16 },
  menuItemPressed: { backgroundColor: '#F8FAFC' },
  menuItemText: { fontSize: 14, color: '#334155', fontWeight: '500' },
});
