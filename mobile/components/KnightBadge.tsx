import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const KnightBadge: React.FC<{ size?: number }> = ({ size = 40 }) => {
  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.helmet, { fontSize: size * 0.48 }]}>🛡️</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e1b4b',
    borderWidth: 1.5,
    borderColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helmet: {
    lineHeight: 24,
  },
});
