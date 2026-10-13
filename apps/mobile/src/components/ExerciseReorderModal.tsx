import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, PanResponder, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import { dragDestination, gapOffset, moveIndex } from "../logic/dragOrder";
import { radius, space, type as ty, usePalette } from "../theme";
import { AppText, BigButton } from "../ui";
import { Icon } from "./Icon";

export interface ReorderItem { id: string; name: string }
const ROW_HEIGHT = 64;

type DragState = { id: string; from: number; to: number } | null;

function DragHandle(props: {
  item: ReorderItem;
  index: number;
  count: number;
  begin: (id: string, index: number) => void;
  move: (dy: number) => void;
  end: () => void;
  cancel: () => void;
  step: (from: number, to: number) => void;
}) {
  const p = usePalette();
  const { t } = useI18n();
  const latest = useRef(props);
  latest.current = props;
  // A drag begins ONLY on the large handle, not by swiping an exercise name or
  // scrolling the list. The responder stays with the finger until it is released.
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => latest.current.begin(latest.current.item.id, latest.current.index),
    onPanResponderMove: (_, gesture) => latest.current.move(gesture.dy),
    onPanResponderRelease: () => latest.current.end(),
    onPanResponderTerminate: () => latest.current.cancel(),
    onPanResponderTerminationRequest: () => false,
  }), []);
  return (
    <View
      {...pan.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t("prog.reorder.accessibility", { exercise: props.item.name })}
      accessibilityHint={t("prog.reorder.hint")}
      accessibilityActions={[{ name: "increment", label: t("prog.down") }, { name: "decrement", label: t("prog.up") }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") latest.current.step(latest.current.index, latest.current.index + 1);
        if (event.nativeEvent.actionName === "decrement") latest.current.step(latest.current.index, latest.current.index - 1);
      }}
      style={{ width: 60, height: ROW_HEIGHT, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name="drag" size={24} color={p.muted} />
    </View>
  );
}

/**
 * Hevy-style full-screen exercise reorderer: exercise NAMES and grip handles only.
 * A held row follows the finger and the surrounding rows make space. The caller's
 * program stays untouched until Done; Cancel discards the temporary arrangement.
 * No extra native dependencies: works in the existing iOS Release build.
 */
export function ExerciseReorderModal(props: {
  visible: boolean;
  title?: string;
  items: readonly ReorderItem[];
  onCancel: () => void;
  onDone: (ids: string[]) => void;
}) {
  const { t } = useI18n();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<ReorderItem[]>([]);
  const [drag, setDrag] = useState<DragState>(null);
  const dragRef = useRef<DragState>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const activeOrder = useRef<ReorderItem[]>(order);
  activeOrder.current = order;

  useEffect(() => {
    if (!props.visible) return;
    setOrder([...props.items]);
    dragRef.current = null;
    setDrag(null);
    dragY.setValue(0);
    // A new opening always starts from the caller's current draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visible]);

  const begin = (id: string, from: number) => {
    dragY.setValue(0);
    dragRef.current = { id, from, to: from };
    setDrag(dragRef.current);
  };
  const move = (dy: number) => {
    const current = dragRef.current;
    if (!current) return;
    dragY.setValue(dy);
    const to = dragDestination(current.from, dy, ROW_HEIGHT, activeOrder.current.length);
    if (to !== current.to) {
      dragRef.current = { ...current, to };
      setDrag(dragRef.current);
    }
  };
  const clearDrag = () => {
    dragRef.current = null;
    setDrag(null);
    dragY.setValue(0);
  };
  const end = () => {
    const current = dragRef.current;
    if (current) setOrder(items => moveIndex(items, current.from, current.to));
    clearDrag();
  };
  const step = (from: number, to: number) => {
    setOrder(items => moveIndex(items, from, to));
  };
  const dismiss = () => {
    clearDrag();
    props.onCancel();
  };
  const done = () => {
    clearDrag();
    props.onDone(order.map(item => item.id));
  };

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={dismiss}>
      <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.xs, borderBottomWidth: 1, borderColor: p.border }}>
          <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600", textAlign: "center" }}>{props.title ?? t("prog.reorder.title")}</AppText>
          <AppText style={{ color: p.muted, fontSize: ty.label, textAlign: "center" }}>{t("prog.reorder.hint")}</AppText>
        </View>

        <ScrollView scrollEnabled={!drag} contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
          {order.map((item, i) => {
            const isDrag = drag?.id === item.id;
            const offset = drag && !isDrag ? gapOffset(i, drag.from, drag.to, ROW_HEIGHT) : 0;
            return (
              <Animated.View
                key={item.id}
                style={{
                  height: ROW_HEIGHT,
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderColor: p.border,
                  backgroundColor: isDrag ? p.card : p.bg,
                  borderRadius: isDrag ? radius.button : 0,
                  opacity: isDrag ? 0.96 : 1,
                  zIndex: isDrag ? 10 : 0,
                  elevation: isDrag ? 8 : 0,
                  transform: [{ translateY: isDrag ? dragY : offset }],
                }}
              >
                <AppText numberOfLines={1} style={{ flex: 1, fontSize: ty.body, fontWeight: isDrag ? "600" : "400", paddingStart: space.sm }}>{item.name}</AppText>
                <DragHandle item={item} index={i} count={order.length} begin={begin} move={move} end={end} cancel={clearDrag} step={step} />
              </Animated.View>
            );
          })}
        </ScrollView>

        <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: insets.bottom + space.md, borderTopWidth: 1, borderColor: p.border, gap: space.sm }}>
          <BigButton label={t("prog.reorder.done")} onPress={done} />
          <BigButton variant="quiet" label={t("prog.reorder.cancel")} onPress={dismiss} />
        </View>
      </View>
    </Modal>
  );
}
