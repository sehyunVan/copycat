/* s3 에서 고른 색. 형태 프로토타입(f1~f7)은 전부 이 팔레트를 쓴다 —
   한 번에 한 축만 바꿔야 판단이 된다. 여기서 바꾸면 일곱 개가 같이 바뀐다. */

export const PASTEL = {
  floor:0xF3E9DE, floorAlt:0xEBDCCF, lounge:0xE7BFB8,
  wall:0xFDF8F3, wallTrim:0xEADCD0,
  wood:0xE0B48A, woodDark:0xC59B78,
  metal:0xCBD4DE, metalDark:0x9AA6B4,
  screen:0xA8C4D8, fabric:0xA8B8E0, fabric2:0xF0A9A0,
  leaf:0xA8D3A0, leafDark:0x86BC8A, pot:0xE8A98C,
  paper:0xFFFDF8, ink:0x6B6560, catnip:0xA9DE9C, glow:0xFFE7B8,
};

/* 광원 위치는 카메라가 +x/+z 코너에 있다는 전제로 잡았다.
   카메라 등 뒤에서 비추면 면이 전부 같은 밝기가 되어 로우폴리의 각이 죽는다.
   보이는 면(+x)을 때리고 반대면(+z)을 그늘로 남기는 각도라야 형태가 읽힌다. */
export const PASTEL_PANELS = [
  { label:'10:00 오전', bg:0xEDE4F0,
    hemi:[0xFFFFFF, 0xD8CFD8, 1.25], sun:[0xFFF6E8, 1.25, [8, 13, -2]],
    fill:[0xD8E4FF, 0.45], lamp:0 },
  { label:'18:00 퇴근 무렵', bg:0xF0D2C8,
    hemi:[0xFFEFE2, 0xD6BCB2, 1.10], sun:[0xFFC49A, 1.35, [10, 3.5, 2]],
    fill:[0xC6D2FF, 0.40], lamp:0.35, screen:0xB6CFE0 },
  { label:'23:00 야근', bg:0x8E93C4,
    hemi:[0xB9BEE8, 0x6F74A0, 0.80], sun:[0x9FA8E0, 0.50, [-3, 9, -6]],
    fill:[0xC0B0E0, 0.40], lamp:1, screen:0xCDEAF2 },
];
