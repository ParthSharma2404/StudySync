import YouTube from 'react-youtube';
import { useState, useEffect } from 'react';

const YouTubePlayer = ({ videoUrl, volume }) => {
  const [player, setPlayer] = useState(null);

  // Extract Video ID from URL
  const getVideoId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const videoId = getVideoId(videoUrl);

  const opts = {
    height: '0',           // Hidden player (audio only)
    width: '0',
    playerVars: {
      autoplay: 1,
      controls: 0,
      modestbranding: 1,
      loop: 1,
      playlist: videoId,     // Important for looping
      rel: 0,
    },
  };

  useEffect(() => {
    if (player && typeof volume === 'number') {
      // react-youtube volume expects 0 to 100
      player.setVolume(volume * 100);
    }
  }, [player, volume]);

  return videoId ? (
    <div style={{ position: 'absolute', top: '-1000px', left: '-1000px', opacity: 0, overflow: 'hidden' }}>
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={(e) => {
          setPlayer(e.target);
          if (typeof volume === 'number') {
            e.target.setVolume(volume * 100);
          }
          // Force play just in case
          e.target.playVideo();
        }}
      />
    </div>
  ) : null;
};

export default YouTubePlayer;
