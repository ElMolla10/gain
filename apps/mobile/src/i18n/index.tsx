import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { I18nManager } from "react-native";
import { directionFor, translate, type Direction, type Lang, type RtlOverride } from "./format";
import type { StringKey } from "./strings";

interface I18nValue {
  lang: Lang;
  direction: Direction;
  isRTL: boolean;
  rtlOverride: RtlOverride;
  /** True when the native layout direction differs from the wanted one until the app restarts. */
  needsRestart: boolean;
  t: (key: StringKey, params?: Record<string, string | number>) => string;
  setLang: (l: Lang) => void;
  setRtlOverride: (o: RtlOverride) => void;
}

const Ctx = createContext<I18nValue | null>(null);

export function I18nProvider(props: {
  initialLang: Lang;
  initialOverride: RtlOverride;
  onChange: (key: "language" | "rtl_override", value: string) => void;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(props.initialLang);
  const [rtlOverride, setOverrideState] = useState<RtlOverride>(props.initialOverride);
  const direction = directionFor(lang, rtlOverride);
  const isRTL = direction === "rtl";

  // Ask the OS layout engine to match for the next launch. The visible UI flips immediately through the root
  // `direction` style (see App.tsx), so the toggle works without a restart.
  useEffect(() => {
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== isRTL) I18nManager.forceRTL(isRTL);
  }, [isRTL]);

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      props.onChange("language", l);
    },
    [props],
  );
  const setRtlOverride = useCallback(
    (o: RtlOverride) => {
      setOverrideState(o);
      props.onChange("rtl_override", o);
    },
    [props],
  );
  const t = useCallback((key: StringKey, params?: Record<string, string | number>) => translate(lang, key, params), [lang]);

  const value = useMemo<I18nValue>(
    () => ({ lang, direction, isRTL, rtlOverride, needsRestart: I18nManager.isRTL !== isRTL, t, setLang, setRtlOverride }),
    [lang, direction, isRTL, rtlOverride, t, setLang, setRtlOverride],
  );
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}
