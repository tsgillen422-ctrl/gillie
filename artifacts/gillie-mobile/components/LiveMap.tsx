import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { useGetFriendLocations, useGetPins, useGetActiveHazards } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

export default function LiveMap() {
  const colors = useColors();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  const { data: friendLocations } = useGetFriendLocations();
  const { data: pins } = useGetPins();
  const { data: hazards } = useGetActiveHazards();

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: 36.54,
          longitude: -85.16,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {friendLocations?.map((fl) =>
          locValid(fl) ? (
            <Marker
              key={fl.userId}
              coordinate={{ latitude: fl.lat!, longitude: fl.lng! }}
              title={fl.displayName}
            />
          ) : null
        )}
        {pins?.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            title={pin.title}
          />
        ))}
        {hazards?.map((hazard) => (
          <Marker
            key={hazard.id}
            coordinate={{ latitude: hazard.lat, longitude: hazard.lng }}
            title={hazard.title}
            pinColor={colors.destructive}
          />
        ))}
        {location && (
          <Marker
            coordinate={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            }}
            title="Me"
            pinColor={colors.primary}
          />
        )}
      </MapView>
    </View>
  );
}

function locValid(loc: any) {
  return loc && typeof loc.lat === "number" && typeof loc.lng === "number";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
