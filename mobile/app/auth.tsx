import { useEffect } from 'react';
import { Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackScreen() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#3f3f46' }}>
        Completing Knightly sign-in...
      </Text>
    </View>
  );
}
