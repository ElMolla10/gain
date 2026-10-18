import { Alert } from "react-native";
import { MenuSheet } from "../components/LogParts";
import { formatClock } from "../logic/restTimer";
import { ExercisePicker } from "../components/ExercisePicker";
import { ExerciseReorderModal } from "../components/ExerciseReorderModal";
import { WorkoutHelp } from "../components/WorkoutHelp";
import { exerciseLabels } from "../i18n/format";
import { joinSuperset, leaveSuperset } from "../logic/superset";
import { kindOf, kindPatch, SET_KINDS, type SetKind } from "../logic/workoutRows";
import { canEditLoadsFor } from "../logic/setRowState";
import type { WorkoutSession } from "../hooks/useWorkoutSession";

/** Exercise actions, pickers, and exceptional confirmations. */
export function WorkoutSessionSheets({ session }: { session: WorkoutSession }) {
  const {
    reorderOpen, t, busy, reorderSaving, reorderGroups,
    namesBySlot, setReorderOpen, commitReorder, helpOpen, setHelpOpen,
    lang, patch, menuEx, setMenuFor, noteInputs,
    focus, setMachineFor, exState, startReplace, shown,
    setSsFor, ssLabel, applySuperset, askRemove, machineEx,
    machineChoice, chooseMachineStep, kindFor, setKindFor, rows,
    ssFor, subFor, subCands, setSubFor, replaceWith,
    setPickFor, addOpen, library, loaded, setAddOpen,
    addExerciseToday, programmes, libRef, setLibrary, pickFor,
    alternatives, setLoadsOpen, exerciseProps,
  } = session;
  // The ⋮ menu's extra items (logger spec §4): pain / dizziness reporting (moved out of the live card, C10) and the rest switch when
  // rest is off in general. Both call the same handlers as before.
  const menuProps = menuEx ? exerciseProps(menuEx, shown.indexOf(menuEx)) : null;
  const reportPain = menuProps?.card ? () => setTimeout(() => Alert.alert(t("live.report"), undefined, [
    { text: t("live.severePain"), onPress: () => menuProps.onLiveReport("severe_pain") },
    { text: t("live.dizziness"), onPress: () => menuProps.onLiveReport("dizziness") },
    { text: t("common.cancel"), style: "cancel" },
  ]), 150) : null;
  return <>
      <ExerciseReorderModal
        visible={reorderOpen}
        title={t("workout.reorder.title")}
        busy={reorderSaving}
        items={reorderGroups.map(block => ({ id: block.id, name: block.slots.map(slot => namesBySlot.get(slot) ?? slot).join(" + ") }))}
        onCancel={() => setReorderOpen(false)}
        onDone={(ids) => void commitReorder(ids)}
      />
      <WorkoutHelp visible={helpOpen} onClose={() => setHelpOpen(false)} />
      <MenuSheet
        visible={menuEx !== undefined}
        title={menuEx ? exerciseLabels(menuEx, lang).primary : ""}
        onClose={() => setMenuFor(null)}
        items={
          menuEx
            ? [
                ...(reportPain ? [{ label: t("rack.menu.pain"), onPress: reportPain }] : []),
                ...(menuProps && !menuProps.restGlobal ? [{ label: t("rack.menu.rest", { time: menuProps.st.restOff ? t("workout.restOffShort") : formatClock(menuProps.restDurationMs) }), onPress: () => menuProps.onToggleRest() }] : []),
                { label: t("workout.menu.notes"), onPress: () => setTimeout(() => noteInputs.current[menuEx.slot]?.focus(), 150) },
                ...(menuEx.equipment === "machine" ? [{ label: t("workout.menu.machineSteps"), onPress: () => setMachineFor(menuEx.slot) }] : []),
                // Available weights moved here from the exercise header, so a long name keeps the header to one line (L-12).
                ...(canEditLoadsFor(menuEx) ? [{ label: t("workout.loads"), onPress: () => setLoadsOpen(o => ({ ...o, [menuEx.exerciseId]: true })) }] : []),
                ...(exState[menuEx.slot]?.added ? [] : [{ label: t("workout.menu.replace"), onPress: () => startReplace(menuEx) }]),
                ...(shown.length > 1 ? [{ label: t("workout.menu.superset"), onPress: () => setSsFor(menuEx.slot) }] : []),
                ...(ssLabel[menuEx.slot] ? [{ label: t("workout.menu.supersetLeave"), onPress: () => void applySuperset(leaveSuperset(menuEx.slot)) }] : []),
                { label: t("workout.menu.remove"), danger: true, onPress: () => askRemove(menuEx, exerciseLabels(menuEx, lang).primary) },
              ]
            : []
        }
      />
      <MenuSheet
        visible={machineEx !== undefined}
        title={t("workout.menu.machineSteps")}
        onClose={() => setMachineFor(null)}
        items={machineEx ? ([
          { kind: "pin" as const, step: 2.5 as const, label: t("workout.machine.pin", { step: 2.5 }) },
          { kind: "pin" as const, step: 5 as const, label: t("workout.machine.pin", { step: 5 }) },
          { kind: "plate" as const, step: undefined, label: t("workout.machine.plate") },
        ]).map(choice => ({
          label: choice.label,
          selected: machineChoice?.machineLoadKind === choice.kind && (choice.kind === "plate" || machineChoice?.machinePinStep === choice.step),
          onPress: () => void chooseMachineStep(machineEx, choice.kind, choice.step),
        })) : []}
      />
      <MenuSheet
        visible={kindFor !== null}
        title={t("workout.kind.title")}
        onClose={() => setKindFor(null)}
        items={SET_KINDS.map((k: SetKind) => {
          const cur = kindFor ? (rows[kindFor.exId] ?? []).find((r) => r.key === kindFor.key) : undefined;
          const on = cur ? kindOf(cur) === k : false;
          return {
            label: t(`workout.kind.${k}` as never),
            selected: on,
            onPress: () => {
              if (!kindFor || !cur) return;
              patch(kindFor.exId, kindFor.key, kindPatch(k, cur.tags));
            },
          };
        })}
      />
      <MenuSheet
        visible={ssFor !== null}
        title={t("workout.superset.pick")}
        onClose={() => setSsFor(null)}
        items={shown
          .filter((e) => e.slot !== ssFor)
          .map((e) => ({
            label: exerciseLabels(e, lang).primary,
            onPress: () => ssFor && void applySuperset(joinSuperset(exState, ssFor, e.slot)),
          }))}
      />
      <MenuSheet
        visible={subFor !== null}
        title={subCands.length === 0 ? t("coach.sub.none") : t("coach.sub.title")}
        onClose={() => setSubFor(null)}
        items={
          subFor
            ? [
                ...subCands.map((c) => ({
                  label: exerciseLabels(c, lang).primary,
                  onPress: () => subFor && void replaceWith(subFor.slot, c.id),
                })),
                {
                  label: t("coach.sub.fatigue"),
                  selected: subFor.fatigue,
                  onPress: () => {
                    const next = { slot: subFor.slot, fatigue: !subFor.fatigue };
                    setTimeout(() => setSubFor(next), 0);
                  },
                },
                {
                  label: t("coach.sub.other"),
                  onPress: () => {
                    const slot = subFor.slot;
                    setTimeout(() => setPickFor(slot), 0);
                  },
                },
              ]
            : []
        }
      />
      <ExercisePicker
        visible={addOpen}
        exercises={library}
        exclude={[...loaded.slots.map((e) => e.exerciseId), ...Object.values(exState).flatMap((x) => (x.replacedBy ? [x.replacedBy] : []))]}
        onClose={() => setAddOpen(false)}
        onPick={(id) => void addExerciseToday(id)}
        onCreate={async (input) => {
          const id = await programmes.createExercise(input);
          libRef.current = await programmes.listExercises();
          setLibrary(libRef.current);
          return id;
        }}
      />
      <ExercisePicker
        visible={pickFor !== null}
        exercises={library}
        suggested={alternatives}
        exclude={shown.map((e) => e.exerciseId)}
        onClose={() => setPickFor(null)}
        onPick={(id) => pickFor && void replaceWith(pickFor, id)}
        onCreate={async (input) => {
          const id = await programmes.createExercise(input);
          libRef.current = await programmes.listExercises();
          setLibrary(libRef.current);
          return id;
        }}
      />
  </>;
}
