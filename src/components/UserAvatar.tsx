import React, { useEffect, useState } from 'react';
import { getProfileInitials } from '../utils/imageCompress';

interface UserAvatarProps {
  displayName: string;
  avatarDataUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-20 h-20 text-xl',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  displayName,
  avatarDataUrl,
  size = 'md',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarDataUrl]);

  const showImage = Boolean(avatarDataUrl && !imgFailed);
  const initials = getProfileInitials(displayName);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-mm-border shrink-0 flex items-center justify-center font-extrabold select-none ${SIZE_CLASSES[size]} ${className}`}
      style={
        showImage
          ? undefined
          : {
              background: 'linear-gradient(135deg, var(--mm-primary), var(--mm-secondary))',
              color: 'var(--mm-primary-fg)',
            }
      }
      aria-label={displayName ? `Foto profil ${displayName}` : 'Avatar profil MY MONEY'}
    >
      {showImage ? (
        <img
          src={avatarDataUrl ?? undefined}
          alt={displayName || 'Foto Profil'}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};
