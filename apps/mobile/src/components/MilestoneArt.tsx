import React from "react";
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as Label } from "react-native-svg";

const tiers = {
  first_workout: [1], showing_up: [4,12,26,52], dedicated: [10,25,50,100],
  first_pr: [1], across_the_board: [3,5,10], called_it: [1], back_at_it: [1],
  lifetime_plate: [10,50,100,250,500,1000],
} as const;
export type MilestoneFamily = keyof typeof tiers;
const lime = "#beef28";
const glyphs = {
  first_workout: "M21 50h12m-9-7h9m11-10v33m6-33v33m2-17h26m0-7v14",
  showing_up: "M28 35h44v33H28z M29 44h42 M37 29v11m25-11v11 M39 55l7 6 15-13",
  dedicated: "M30 62l28-28 10 10-28 28z M26 61l13 13m18-44 15 15 M36 59l11 1m-5-8 11 1m-4-8 10 1",
  first_pr: "M25 57h50m-42-7v14m6-18v22m22-22v22m6-18v14 M50 49V29m-8 8 8-8 8 8",
  across_the_board: "M24 64V53h12v11z M44 64V43h12v21z M64 64V32h12v32z",
  called_it: "M65 52a17 17 0 1 1-17-17 M57 52a9 9 0 1 1-9-9 M48 52l17-17 1-8 7-3-1 9-7 2",
  back_at_it: "M29 46a22 22 0 1 1 2 19 M29 33v14h14 M58 52a8 8 0 1 1-16 0 8 8 0 1 1 16 0",
} as const;

export function MilestoneArt({family,tier,size=48,label}: {
  family: MilestoneFamily; tier:number; size?:number; label:string;
}) {
  const levels: readonly number[] = tiers[family];
  const rank = levels.indexOf(tier);
  if (rank < 0) return null;
  const plate = family === "lifetime_plate";
  const titanium = plate && tier === 1000;
  const finish = plate ? ["#98a1a4","#24754b","#d19b24","#365db2","#ae3c38","#41484b"][rank] : "#424941";
  const octagon = "M29 5h42l24 24v15q-9 6 0 12v15L71 95H29L5 71V56q9-6 0-12V29z";
  return <Svg width={size} height={size} viewBox="0 0 100 100" accessible accessibilityRole="image" accessibilityLabel={label}>
    <Defs>
      <LinearGradient id="rim" x2="85%" y2="100%"><Stop stopColor="#eef0e9"/><Stop offset=".38" stopColor="#808982"/><Stop offset=".6" stopColor="#454c48"/><Stop offset="1" stopColor="#c4cbc4"/></LinearGradient>
      <LinearGradient id="face" x2="60%" y2="100%"><Stop stopColor={finish}/><Stop offset="1" stopColor="#181c19"/></LinearGradient>
    </Defs>
    {plate ? <G>
      <Circle cx="50" cy="50" r="47" fill="url(#face)" stroke={titanium?"url(#rim)":finish} strokeWidth="4"/>
      <Circle cx="50" cy="50" r="41" fill="none" stroke={finish} strokeWidth="2"/>
      <Circle cx="50" cy="46" r="12" fill="#111511" stroke="url(#rim)" strokeWidth="4"/>
      <Label x="50" y="28" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#f1f4eb">GAIN</Label>
      <Label x="50" y="80" textAnchor="middle" fontSize="23" fontWeight="bold" fill={titanium?lime:"#f1f4eb"}>{titanium?"1K":tier}</Label>
      {Array.from({length:rank+1},(_,i)=><Path key={i} d={`M16 ${39+i*3}h7m54 0h7`} stroke={titanium?lime:"#c7cfc5"} strokeWidth="1.5"/>)}
    </G> : <G>
      <Path d={octagon} fill="url(#face)" stroke="url(#rim)" strokeWidth="4"/>
      <Path d={glyphs[family as keyof typeof glyphs]} fill="none" stroke={lime} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      {levels.length>1 && <Label x="50" y="85" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#edf1e8">{tier}</Label>}
    </G>}
  </Svg>;
}
