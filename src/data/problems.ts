import type { Problem } from '../types';

export const PROBLEMS: Problem[] = [
  {
    id: 'two-sum',
    title: 'Two Sum (Pair Target Finder)',
    difficulty: 'Easy',
    timeLimitMinutes: 45,
    description: `Given an array of integers \`nums\` and an integer \`target\`, return the **indices** of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order (indices ascending).

### Stress-Free Guidance
- You don't need to memorize Map or object syntax! Use the **Reference Manual (Ctrl+K)** tab to look up \`Map\` or \`reduce\` if needed.
- A brute force $O(n^2)$ solution works, but a single-pass hash map achieves an optimal $O(n)$ time complexity.`,
    tags: ['Hash Table', 'Arrays', 'Two Pointers'],
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.'
    ],
    examples: [
      {
        input: 'nums = [2, 7, 11, 15], target = 9',
        output: '[0, 1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].'
      },
      {
        input: 'nums = [3, 2, 4], target = 6',
        output: '[1, 2]',
        explanation: 'Because nums[1] + nums[2] == 6, we return [1, 2].'
      },
      {
        input: 'nums = [3, 3], target = 6',
        output: '[0, 1]',
        explanation: 'Both duplicate values add up to 6.'
      }
    ],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  // Your code here
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
      python: `def twoSum(nums, target):
    """
    :type nums: List[int]
    :type target: int
    :rtype: List[int]
    """
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
`
    },
    testCases: [
      {
        id: 'tc-1',
        label: 'Basic Positive Pair',
        input: JSON.stringify([[2, 7, 11, 15], 9]),
        expected: JSON.stringify([0, 1]),
      },
      {
        id: 'tc-2',
        label: 'Unsorted Target in Middle',
        input: JSON.stringify([[3, 2, 4], 6]),
        expected: JSON.stringify([1, 2]),
      },
      {
        id: 'tc-3',
        label: 'Duplicate Numbers',
        input: JSON.stringify([[3, 3], 6]),
        expected: JSON.stringify([0, 1]),
      },
      {
        id: 'tc-4',
        label: 'Negative Numbers & Zero',
        input: JSON.stringify([[-3, 4, 3, 90], 0]),
        expected: JSON.stringify([0, 2]),
      },
      {
        id: 'tc-5',
        label: 'Large Offset Elements (Hidden)',
        input: JSON.stringify([[100000, 500, 200, 300000], 300500]),
        expected: JSON.stringify([1, 3]),
        isHidden: true,
      }
    ]
  },
  {
    id: 'valid-anagram',
    title: 'Valid Anagram (String Frequency)',
    difficulty: 'Easy',
    timeLimitMinutes: 30,
    description: `Given two strings \`s\` and \`t\`, return \`true\` if \`t\` is an anagram of \`s\`, and \`false\` otherwise.

An **Anagram** is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.

### Stress-Free Guidance
- Consider what happens if lengths differ initially.
- You can solve this either by sorting both strings or counting character frequencies.`,
    tags: ['Hash Table', 'String', 'Sorting'],
    constraints: [
      '1 <= s.length, t.length <= 5 * 10^4',
      's and t consist of lowercase English letters.'
    ],
    examples: [
      {
        input: 's = "anagram", t = "nagaram"',
        output: 'true'
      },
      {
        input: 's = "rat", t = "car"',
        output: 'false'
      }
    ],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @param {string} t
 * @return {boolean}
 */
function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  
  // Tip: Check Reference Manual for frequency counting patterns
  const count = {};
  for (const ch of s) count[ch] = (count[ch] || 0) + 1;
  for (const ch of t) {
    if (!count[ch]) return false;
    count[ch]--;
  }
  return true;
}`,
      python: `def isAnagram(s: str, t: str) -> bool:
    if len(s) != len(t):
        return False
    from collections import Counter
    return Counter(s) == Counter(t)
`
    },
    testCases: [
      {
        id: 'tc-1',
        label: 'Basic True Anagram',
        input: JSON.stringify(["anagram", "nagaram"]),
        expected: "true",
      },
      {
        id: 'tc-2',
        label: 'Different Characters',
        input: JSON.stringify(["rat", "car"]),
        expected: "false",
      },
      {
        id: 'tc-3',
        label: 'Different Lengths',
        input: JSON.stringify(["a", "ab"]),
        expected: "false",
      },
      {
        id: 'tc-4',
        label: 'Repeating Letters (Hidden)',
        input: JSON.stringify(["aabbcc", "bbaacc"]),
        expected: "true",
        isHidden: true,
      }
    ]
  },
  {
    id: 'merge-intervals',
    title: 'Merge Overlapping Intervals',
    difficulty: 'Medium',
    timeLimitMinutes: 60,
    description: `Given an array of \`intervals\` where \`intervals[i] = [start_i, end_i]\`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.

### Stress-Free Guidance
- Remember to sort the intervals by their starting values first. Check the **Reference Manual** for \`Array.prototype.sort\` comparator syntax!`,
    tags: ['Array', 'Sorting', 'Intervals'],
    constraints: [
      '1 <= intervals.length <= 10^4',
      'intervals[i].length == 2',
      '0 <= start_i <= end_i <= 10^4'
    ],
    examples: [
      {
        input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]',
        output: '[[1,6],[8,10],[15,18]]',
        explanation: 'Since intervals [1,3] and [2,6] overlap, merge them into [1,6].'
      },
      {
        input: 'intervals = [[1,4],[4,5]]',
        output: '[[1,5]]',
        explanation: 'Intervals [1,4] and [4,5] are considered overlapping.'
      }
    ],
    starterCode: {
      javascript: `/**
 * @param {number[][]} intervals
 * @return {number[][]}
 */
function merge(intervals) {
  if (intervals.length <= 1) return intervals;
  
  // Sort intervals by start time
  intervals.sort((a, b) => a[0] - b[0]);
  
  const result = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i];
    const last = result[result.length - 1];
    
    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      result.push(current);
    }
  }
  return result;
}`,
      python: `def merge(intervals):
    if len(intervals) <= 1:
        return intervals
    intervals.sort(key=lambda x: x[0])
    merged = [intervals[0]]
    for current in intervals[1:]:
        last = merged[-1]
        if current[0] <= last[1]:
            last[1] = max(last[1], current[1])
        else:
            merged.append(current)
    return merged
`
    },
    testCases: [
      {
        id: 'tc-1',
        label: 'Overlapping Pairs',
        input: JSON.stringify([[[1, 3], [2, 6], [8, 10], [15, 18]]]),
        expected: JSON.stringify([[1, 6], [8, 10], [15, 18]]),
      },
      {
        id: 'tc-2',
        label: 'Touching Boundaries',
        input: JSON.stringify([[[1, 4], [4, 5]]]),
        expected: JSON.stringify([[1, 5]]),
      },
      {
        id: 'tc-3',
        label: 'Subsumed Interval (Hidden)',
        input: JSON.stringify([[[1, 10], [2, 5], [6, 8]]]),
        expected: JSON.stringify([[1, 10]]),
        isHidden: true,
      }
    ]
  }
];
