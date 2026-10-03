import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { NO_FILTER, type TemplateFilter } from "../logic/templateFilter";
import { pickerView, toggleFilter } from "../logic/templatePicker";
import type { Template } from "../logic/templateTypes";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip } from "../ui";

/**
 * Programme templates grouped by days per week, with filters for days, Home / Gym, the equipment you have, goal and level.
 * Used by the first-run setup (days already known, so no days filter) and the programme switcher. Nothing is chosen for you.
 */
export function TemplateBrowser(props: {
  templates: readonly Template[];
  showDaysFilter: boolean;
  actionLabel: (t: Template) => string;
  onPick: (t: Template) => void;
  disabled?: boolean;
  /** Extra line under a card (e.g. "arranged for fewer days than you train"). */
  noteFor?: (t: Template) => string | null;
}) {
  const { t, lang } = useI18n();
  const p = usePalette();
  const [filter, setFilter] = useState<TemplateFilter>(NO_FILTER);
  const view = useMemo(() => pickerView(props.templates, filter, { showDays: props.showDaysFilter }), [props.templates, filter, props.showDaysFilter]);
  const name = (x: Template) => (lang === "ar" ? x.ar : x.en);

  return (
    <View style={{ gap: space.md }}>
      <AppText style={{ fontSize: 16, fontWeight: "600" }}>{t("tpl.filters")}</AppText>
      {view.facets.map((f) => (
        <View key={f.facet} style={{ gap: space.xs }}>
          <AppText style={{ fontWeight: "600" }}>{t(f.titleKey)}</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            <Chip label={t("tpl.all")} selected={filter[f.facet] === null} onPress={() => setFilter({ ...filter, [f.facet]: null })} />
            {f.options.map((o) => (
              <Chip
                key={String(o.value)}
                label={o.labelKey ? t(o.labelKey) : t("tpl.days.n", { n: o.value as number })}
                selected={o.selected}
                disabled={o.disabled}
                onPress={() => setFilter(toggleFilter(filter, f.facet, o.value))}
              />
            ))}
          </View>
          {f.facet === "venue" ? <AppText style={{ color: p.muted, fontSize: 13 }}>{t("tpl.venue.note")}</AppText> : null}
        </View>
      ))}
      <AppText style={{ color: p.muted }}>{t("tpl.count", { n: view.total })}</AppText>
      {view.active > 0 ? <BigButton label={t("tpl.clear")} selected={false} onPress={() => setFilter(NO_FILTER)} /> : null}
      {view.total === 0 ? <AppText style={{ fontWeight: "600" }}>{t("tpl.none")}</AppText> : null}
      {view.sections.map((g) => (
        <View key={g.days} style={{ gap: space.sm }}>
          <AppText style={{ fontSize: 20, fontWeight: "600" }}>{t("tpl.group", { n: g.days })}</AppText>
          {g.templates.map((x) => {
            const note = props.noteFor?.(x) ?? null;
            return (
              <Card key={x.id}>
                <AppText style={{ fontSize: 16, fontWeight: "600" }}>{name(x)}</AppText>
                {lang === "ar" ? <AppText style={{ color: p.muted, fontSize: 13 }}>{t("tpl.arDraft")}</AppText> : null}
                <AppText style={{ color: p.muted }}>{[t(`tpl.level.${x.level}` as StringKey), t(`tpl.gear.needs.${x.gear}` as StringKey), t(`tpl.goal.${x.goal}` as StringKey)].join(" · ")}</AppText>
                <AppText style={{ color: p.muted }}>{x.schedule.map((d) => (lang === "ar" ? d.ar : d.en)).join(" · ")}</AppText>
                {x.schedule.length !== x.days ? <AppText style={{ color: p.muted, fontSize: 13 }}>{t("tpl.rotation", { n: x.schedule.length, d: x.days })}</AppText> : null}
                {x.goal === "bulking" ? <AppText style={{ color: p.muted, fontSize: 13 }}>{t("tpl.bulking.note")}</AppText> : null}
                {note ? <AppText style={{ color: p.muted }}>{note}</AppText> : null}
                <BigButton label={props.actionLabel(x)} selected={false} disabled={props.disabled} onPress={() => props.onPick(x)} />
              </Card>
            );
          })}
        </View>
      ))}
    </View>
  );
}
