import type { Problem } from '../types';

export const PROBLEMS: Problem[] = [
  {
    id: 'two-sum',
    title: 'Two Sum (Pair Target Finder)',
    difficulty: 'Easy',
    timeLimitMinutes: 45,
    description: `Given an array of integers \`nums\` and an integer \`target\`, return the **indices** of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order (indices ascending).`,
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
  
}`,
      python: `def twoSum(nums, target):
    """
    :type nums: List[int]
    :type target: int
    :rtype: List[int]
    """
    # Your code here
    pass
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

An **Anagram** is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.`,
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
  // Your code here
  
}`,
      python: `def isAnagram(s: str, t: str) -> bool:
    # Your code here
    pass
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
    description: `Given an array of \`intervals\` where \`intervals[i] = [start_i, end_i]\`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.`,
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
  // Your code here
  
}`,
      python: `def merge(intervals):
    # Your code here
    pass
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
