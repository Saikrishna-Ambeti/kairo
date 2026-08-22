import Svg, { Defs, LinearGradient, Path, Polygon, Stop } from "react-native-svg";

/** Kairo's gradient K mark, shared visually with the desktop sidebar. */
export function KairoMark(props: { readonly size: number }) {
  return (
    <Svg accessible={false} height={props.size} viewBox="0 0 115.6 115.6" width={props.size}>
      <Defs>
        <LinearGradient
          gradientUnits="userSpaceOnUse"
          id="kairo-mark-lower"
          x1="41.78"
          x2="103.6"
          y1="90.09"
          y2="88.58"
        >
          <Stop offset="0" stopColor="#101C50" />
          <Stop offset="1" stopColor="#5E35BD" />
        </LinearGradient>
        <LinearGradient
          gradientUnits="userSpaceOnUse"
          id="kairo-mark-stem"
          x1="12.63"
          x2="38.67"
          y1="19.37"
          y2="51.18"
        >
          <Stop offset="0" stopColor="#5A32BA" />
          <Stop offset="1" stopColor="#5430AA" />
        </LinearGradient>
        <LinearGradient
          gradientUnits="userSpaceOnUse"
          id="kairo-mark-highlight"
          x1="26.34"
          x2="26.34"
          y1="12.42"
          y2="59.76"
        >
          <Stop offset="0" stopColor="#5D3DC2" />
          <Stop offset="1" stopColor="#7B7AF1" />
        </LinearGradient>
        <LinearGradient
          gradientUnits="userSpaceOnUse"
          id="kairo-mark-arm"
          x1="12.64"
          x2="97.81"
          y1="99.76"
          y2="16.43"
        >
          <Stop offset="0" stopColor="#101C5F" />
          <Stop offset="0.5061" stopColor="#5633AE" />
          <Stop offset="1" stopColor="#8D3CF9" />
        </LinearGradient>
        <LinearGradient
          gradientUnits="userSpaceOnUse"
          id="kairo-mark-edge"
          x1="25.33"
          x2="86.86"
          y1="65.15"
          y2="65.15"
        >
          <Stop offset="0" stopColor="#3B54BC" />
          <Stop offset="1" stopColor="#875CE6" />
        </LinearGradient>
      </Defs>
      <Polygon fill="url(#kairo-mark-lower)" points="103.6 110.6 69.1 110.6 38.8 78.1 57.6 59.3" />
      <Polygon fill="url(#kairo-mark-stem)" points="38.7 12 12.7 12 12.7 73.2 38.7 45.4 38.7 12" />
      <Polygon
        fill="url(#kairo-mark-highlight)"
        points="25.5 12.3 25.4 12.3 25.4 58.5 26.7 57.1 26.7 12.3"
      />
      <Path d="m69.3 12-56.6 60.2v38.5h27V83.8l2.9-3.1 61-68.7H69.3Z" fill="url(#kairo-mark-arm)" />
      <Polygon
        fill="url(#kairo-mark-edge)"
        points="86.9 12.9 25.4 76.9 25.3 77 25.3 110.6 26.7 110.6 26.7 77.7 41 62.2 85.8 109.7 86.9 110.5 89 110.5 41.9 61.1"
      />
    </Svg>
  );
}
