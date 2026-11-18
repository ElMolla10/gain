import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Icon, type IconName } from "../Icon";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText, Card } from "../../ui";

export function SettingsSection({ title, note, icon, children }: {
  title: string;
  note: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={note}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", minHeight: 68, gap: space.md,
          paddingVertical: space.sm, paddingHorizontal: space.md,
          backgroundColor: pressed || open ? p.raised : p.card,
        })}
      >
        <View style={{ width: 36, height: 36, borderRadius: radius.button, alignItems: "center", justifyContent: "center", backgroundColor: p.tint }}>
          <Icon name={icon} color={p.text} size={20} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontSize: ty.body, fontWeight: "700" }}>{title}</AppText>
          <AppText style={{ fontSize: ty.label, color: p.muted }}>{note}</AppText>
        </View>
        <Icon name={open ? "minus" : "plus"} color={p.muted} size={18} />
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm, borderTopWidth: 1, borderColor: p.border }}>
          {children}
        </View>
      ) : null}
    </Card>
  );
}
