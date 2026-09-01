import { registerRootComponent } from 'expo';
import { Text, View } from 'react-native';

let App;
try {
  App = require('./App').default;
} catch (e) {
  console.log('IMPORT CRASH:', e);
  App = function CrashScreen() {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20 }}>
        <Text style={{ color: 'red', fontSize: 16, fontWeight: '700', marginBottom: 10 }}>
          Import Crash
        </Text>
        <Text style={{ fontSize: 13 }}>{String(e?.message || e)}</Text>
        <Text style={{ fontSize: 11, color: '#666', marginTop: 10 }}>
          {String(e?.stack || '')}
        </Text>
      </View>
    );
  };
}

registerRootComponent(App);