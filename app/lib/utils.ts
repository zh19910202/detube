// This is the new utility file.
// Functions will be added here as per the subtask.

export const formatDisplayAddress = (address?: string): string => {
  if (!address) return 'Unknown Creator';
  if (address.length <= 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// 添加防抖函数
export function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return function (...args: Parameters<T>) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
