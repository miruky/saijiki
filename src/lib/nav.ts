// ロービングタブ(矢印で移動するタブ群)の移動先を計算する純粋関数。
// 左右(縦並びを想定した上下も)で隣へ、Home/Endで両端へ。端は折り返す。
// 該当キーでなければ null を返し、呼び出し側は既定動作に任せる。

export function nextIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
