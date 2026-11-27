// The production icon, as GitHub shows the Kairo app, whatever this build's channel.
import appIconUrl from "../../../../assets/prod/kairo-black-web-apple-touch-180.png";

export function T3AppIcon(props: { readonly className?: string }) {
  return <img src={appIconUrl} alt="" className={props.className} />;
}
