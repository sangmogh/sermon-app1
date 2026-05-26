/** 유니코드에 공식 YouTube 이모지 없음 — ▶ 사용 */
const YOUTUBE_PLAY_MARK = "▶";

export function formatYoutubeListenLabel(timeLabel: string): string {
  const time = timeLabel.trim() || "00:00";
  return `${YOUTUBE_PLAY_MARK} ${time}부터 유튜브로 듣기`;
}

type YoutubeListenLinkProps = {
  href: string;
  timeLabel: string;
  className: string;
  ariaLabel: string;
};

export function YoutubeListenLink({
  href,
  timeLabel,
  className,
  ariaLabel,
}: YoutubeListenLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={ariaLabel}
    >
      {formatYoutubeListenLabel(timeLabel)}
    </a>
  );
}
