import type { ReferenceEntry } from '../types';

export const REFERENCE_ENTRIES: ReferenceEntry[] = [
  // ===================== ARRAYS & LISTS =====================
  {
    id: 'js-array-slice',
    name: 'Array.prototype.slice()',
    category: 'arrays',
    language: 'javascript',
    signature: 'arr.slice([start[, end]]) -> Array',
    mutatesVsReturns: 'Returns a shallow copy of a portion of the array. Does NOT mutate the original array.',
    timeComplexity: 'O(k) where k = end - start',
    spaceComplexity: 'O(k) for new array',
    description: 'Extracts a section of an array and returns a new array without modifying the source.',
    snippet: `// Edge case: Negative indices count from the end
const items = [10, 20, 30, 40, 50];
const sub = items.slice(1, 4); // [20, 30, 40]
const lastTwo = items.slice(-2); // [40, 50]
const fullCopy = items.slice(); // Fast shallow clone`,
    edgeCasesNotes: 'End index is exclusive. Negative indices wrap around from length.',
    tags: ['array', 'slice', 'copy', 'subarray', 'immutable']
  },
  {
    id: 'js-array-splice',
    name: 'Array.prototype.splice()',
    category: 'arrays',
    language: 'javascript',
    signature: 'arr.splice(start[, deleteCount[, item1[, item2, ...]]]) -> Array',
    mutatesVsReturns: 'MUTATES the original array in-place. Returns an array containing the deleted elements.',
    timeComplexity: 'O(N) due to element shifting',
    spaceComplexity: 'O(k) for returned deleted items',
    description: 'Changes contents of an array by removing or replacing existing elements and/or adding new elements in place.',
    snippet: `const arr = ['a', 'b', 'c', 'd'];
// Remove 1 element at index 1 and insert 'X', 'Y'
const removed = arr.splice(1, 1, 'X', 'Y');
// arr is now: ['a', 'X', 'Y', 'c', 'd']
// removed is: ['b']`,
    edgeCasesNotes: 'Mutates in place! If deleteCount is 0, elements are only inserted.',
    tags: ['array', 'splice', 'insert', 'delete', 'mutate', 'in-place']
  },
  {
    id: 'js-array-reduce',
    name: 'Array.prototype.reduce()',
    category: 'arrays',
    language: 'javascript',
    signature: 'arr.reduce((acc, curr, index, arr) => { ... }, initialValue) -> any',
    mutatesVsReturns: 'Returns the accumulated result. Does NOT mutate original array unless accumulator mutates inputs.',
    timeComplexity: 'O(N) iterates every element',
    spaceComplexity: 'O(1) or O(K) depending on accumulator type',
    description: 'Executes a user-supplied reducer callback function on each element of the array in order.',
    snippet: `// Frequency counter pattern
const words = ['apple', 'banana', 'apple', 'orange'];
const freq = words.reduce((acc, word) => {
  acc[word] = (acc[word] || 0) + 1;
  return acc;
}, {} as Record<string, number>);
// freq: { apple: 2, banana: 1, orange: 1 }`,
    edgeCasesNotes: 'Always supply initialValue to avoid errors on empty arrays.',
    tags: ['array', 'reduce', 'aggregate', 'frequency', 'sum']
  },
  {
    id: 'py-list-comprehension',
    name: 'List Comprehensions & Slicing',
    category: 'arrays',
    language: 'python',
    signature: '[expr for item in iterable if condition] / lst[start:stop:step]',
    mutatesVsReturns: 'Returns a brand new list. Original list remains untouched.',
    timeComplexity: 'O(N) for list creation',
    spaceComplexity: 'O(N) for newly allocated list',
    description: 'Concise syntax for filtering, transforming, or slicing Python sequences.',
    snippet: `# Filter even squares
nums = [1, 2, 3, 4, 5, 6]
evens_squared = [x**2 for x in nums if x % 2 == 0]

# List reversal via slice (O(N) time and space)
reversed_nums = nums[::-1]

# In-place reversal (O(1) space):
nums.reverse()`,
    edgeCasesNotes: 'nums[::-1] creates a new copy; nums.reverse() mutates nums in place.',
    tags: ['python', 'list', 'comprehension', 'slice', 'reverse']
  },

  // ===================== HASHMAPS & SETS =====================
  {
    id: 'js-map-operations',
    name: 'Map (Key-Value Store)',
    category: 'objects_maps',
    language: 'javascript',
    signature: 'new Map() | map.set(k, v) | map.get(k) | map.has(k) | map.delete(k)',
    mutatesVsReturns: '`map.set()` and `map.delete()` MUTATE the Map in-place. `map.get()` and `map.has()` return values.',
    timeComplexity: 'O(1) average lookup/insert/delete',
    spaceComplexity: 'O(N) storage',
    description: 'Hash table with arbitrary key types (objects, primitives), preserving insertion order.',
    snippet: `const map = new Map<number, number>();
// Fast frequency / seen lookup
map.set(10, 1);
if (map.has(10)) {
  const current = map.get(10)!;
  map.set(10, current + 1);
}
// Iterating key-value pairs
for (const [key, val] of map.entries()) {
  console.log(key, val);
}`,
    edgeCasesNotes: 'Keys are compared with SameValueZero. Object keys are matched by reference, not structure.',
    tags: ['map', 'hashmap', 'lookup', 'dictionary', 'key-value']
  },
  {
    id: 'js-set-operations',
    name: 'Set (Unique Collection)',
    category: 'objects_maps',
    language: 'javascript',
    signature: 'new Set(iterable) | set.add(val) | set.has(val) | set.delete(val)',
    mutatesVsReturns: '`set.add()` and `set.delete()` MUTATE the Set. `set.has()` returns boolean.',
    timeComplexity: 'O(1) average add/has/delete',
    spaceComplexity: 'O(N) unique elements',
    description: 'Stores unique values of any type with high-performance O(1) membership testing.',
    snippet: `// Deduplicate array
const nums = [1, 2, 2, 3, 4, 4, 5];
const unique = Array.from(new Set(nums)); // [1, 2, 3, 4, 5]

// Fast membership test
const visited = new Set<string>();
visited.add('0,0');
if (visited.has('0,0')) {
  // Already processed coordinate
}`,
    edgeCasesNotes: 'NaN is considered equal to NaN in Set. Primitive strings/numbers match by value.',
    tags: ['set', 'unique', 'deduplicate', 'membership', 'hashset']
  },
  {
    id: 'py-dict-collections',
    name: 'collections.defaultdict & Counter',
    category: 'objects_maps',
    language: 'python',
    signature: 'from collections import defaultdict, Counter',
    mutatesVsReturns: 'Mutates in-place when updating keys. Returns key counts or default values.',
    timeComplexity: 'O(1) average lookup/insertion',
    spaceComplexity: 'O(N) elements',
    description: 'Specialized dictionary subclasses for effortless frequency counting and graph adjacency lists.',
    snippet: `from collections import defaultdict, Counter

# 1. Frequency Counter
counts = Counter("anagram")
# counts['a'] -> 3, counts['z'] -> 0 (no KeyError)

# 2. Graph Adjacency List
adj = defaultdict(list)
edges = [[0, 1], [0, 2], [1, 2]]
for u, v in edges:
    adj[u].append(v)
    adj[v].append(u)`,
    edgeCasesNotes: 'Accessing non-existent key in defaultdict automatically inserts default factory value.',
    tags: ['python', 'dict', 'counter', 'defaultdict', 'graph', 'frequency']
  },

  // ===================== QUEUES & STACKS =====================
  {
    id: 'js-stack-queue-array',
    name: 'Stack & Queue via Array',
    category: 'objects_maps',
    language: 'javascript',
    signature: 'stack.push(v) / stack.pop() | queue.push(v) / queue.shift()',
    mutatesVsReturns: 'MUTATES array in-place. push/pop/shift modify original array.',
    timeComplexity: 'Stack push/pop: O(1). Queue shift: O(N) due to index reindexing.',
    spaceComplexity: 'O(N) queue storage',
    description: 'Standard LIFO Stack and FIFO Queue patterns in JavaScript using Array primitives.',
    snippet: `// LIFO Stack (O(1) operations)
const stack: number[] = [];
stack.push(1); // Push to top
const top = stack[stack.length - 1]; // Peek
const popped = stack.pop(); // Remove top (O(1))

// Monotonic Stack Pattern
const monoStack: number[] = [];
for (let i = 0; i < nums.length; i++) {
  while (monoStack.length > 0 && nums[monoStack[monoStack.length - 1]] < nums[i]) {
    const prevIdx = monoStack.pop();
    // Process next greater element
  }
  monoStack.push(i);
}`,
    edgeCasesNotes: 'For high-volume BFS queues in JS, shift() is O(N). Use index pointer `let head = 0` for O(1) pops.',
    tags: ['stack', 'queue', 'lifo', 'fifo', 'monotonic', 'bfs']
  },
  {
    id: 'py-deque-queue',
    name: 'collections.deque (Double-Ended Queue)',
    category: 'objects_maps',
    language: 'python',
    signature: 'from collections import deque | q.append(x) | q.popleft()',
    mutatesVsReturns: 'MUTATES deque in-place.',
    timeComplexity: 'O(1) for both append and popleft',
    spaceComplexity: 'O(N) memory',
    description: 'High performance double-ended queue ideal for BFS graph traversals and sliding window buffers.',
    snippet: `from collections import deque

q = deque([start_node])
visited = {start_node}
steps = 0

while q:
    for _ in range(len(q)):
        node = q.popleft()  # O(1) removal from left
        for neighbor in adj[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                q.append(neighbor)
    steps += 1`,
    edgeCasesNotes: 'Standard list.pop(0) is O(N); deque.popleft() is strictly O(1).',
    tags: ['python', 'deque', 'queue', 'bfs', 'fast']
  },

  // ===================== STRING MANIPULATION =====================
  {
    id: 'js-string-methods',
    name: 'String.prototype.split() & join()',
    category: 'strings',
    language: 'javascript',
    signature: 'str.split(separator[, limit]) -> Array | arr.join(separator) -> String',
    mutatesVsReturns: 'Strings in JavaScript are immutable. split() returns a new Array; join() returns a new String.',
    timeComplexity: 'O(N) string length',
    spaceComplexity: 'O(N) for created structure',
    description: 'Fundamental string conversion utilities for splitting tokens and assembling joined strings.',
    snippet: `// Reverse words in a string
const s = "the sky is blue";
const reversedWords = s
  .trim()
  .split(/\\s+/) // Splits by one or more whitespace
  .reverse()
  .join(" "); // "blue is sky the"

// Character codes
const charCode = "a".charCodeAt(0); // 97
const charFromCode = String.fromCharCode(97); // "a"`,
    edgeCasesNotes: 'split("") splits into UTF-16 code units. For surrogate pairs/emojis, use Array.from(str).',
    tags: ['string', 'split', 'join', 'regex', 'unicode']
  },
  {
    id: 'js-string-regex-replace',
    name: 'String.prototype.replace() & match()',
    category: 'strings',
    language: 'javascript',
    signature: 'str.replace(pattern, replacement) | str.match(regex)',
    mutatesVsReturns: 'Returns a NEW string or match array. Original string is never mutated.',
    timeComplexity: 'O(N) where N is string length',
    spaceComplexity: 'O(N) for output string',
    description: 'Finds and replaces substrings or regular expressions with sanitize support.',
    snippet: `// Palindrome sanitization: keep alphanumeric only
const raw = "A man, a plan, a canal: Panama";
const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
// clean: "amanaplanacanalpanama"

// Check if palindrome:
let left = 0, right = clean.length - 1;
let isPal = true;
while (left < right) {
  if (clean[left++] !== clean[right--]) { isPal = false; break; }
}`,
    edgeCasesNotes: 'Remember /g global flag on regex to replace all instances, not just the first one.',
    tags: ['string', 'replace', 'regex', 'sanitize', 'palindrome']
  },

  // ===================== MATH & NUMBERS =====================
  {
    id: 'js-math-builtins',
    name: 'Math Object (min, max, floor, abs, sqrt)',
    category: 'math',
    language: 'javascript',
    signature: 'Math.min(...vals) | Math.max(...vals) | Math.abs(x) | Math.floor(x)',
    mutatesVsReturns: 'Pure mathematical functions. Always return computed number.',
    timeComplexity: 'O(1) for scalar operations; O(K) for Math.max(...array)',
    spaceComplexity: 'O(1)',
    description: 'Standard built-in mathematical constants and functions.',
    snippet: `// Bound clamping
const clamped = Math.min(Math.max(val, minBound), maxBound);

// Integer division truncation
const intDiv = Math.trunc(7 / 2); // 3
const floorDiv = Math.floor(-3.5); // -4

// Greatest Common Divisor (GCD) Euclid
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}`,
    edgeCasesNotes: 'Math.max(...largeArray) can throw RangeError (Maximum call stack) if array > 65k items. Use reduce instead.',
    tags: ['math', 'min', 'max', 'abs', 'floor', 'gcd']
  },
  {
    id: 'py-math-heapq',
    name: 'heapq (Min-Heap / Max-Heap Priority Queue)',
    category: 'math',
    language: 'python',
    signature: 'import heapq | heappush(heap, item) | heappop(heap) | heapify(list)',
    mutatesVsReturns: 'MUTATES the underlying list in-place to preserve min-heap invariant.',
    timeComplexity: 'heapify: O(N) | heappush / heappop: O(log N)',
    spaceComplexity: 'O(1) extra space beyond list',
    description: 'Binary min-heap implementation for finding Top-K elements, Dijkstra, and streaming medians.',
    snippet: `import heapq

# Min-heap from list in O(N)
nums = [5, 1, 9, 3, 7]
heapq.heapify(nums) # nums[0] is always min: 1

# Extract minimum:
smallest = heapq.heappop(nums) # 1

# For Max-Heap, invert values (-x):
max_heap = []
heapq.heappush(max_heap, -42)
largest = -heapq.heappop(max_heap) # 42`,
    edgeCasesNotes: 'Python heapq is strictly min-heap. Multiply numbers by -1 for max-heap.',
    tags: ['python', 'heap', 'heapq', 'priority-queue', 'top-k', 'min-heap']
  },

  // ===================== SORTING & SEARCHING =====================
  {
    id: 'js-array-sort',
    name: 'Array.prototype.sort() with Comparator',
    category: 'sorting_searching',
    language: 'javascript',
    signature: 'arr.sort([compareFunction]) -> Array',
    mutatesVsReturns: 'MUTATES the array in-place and returns the same array reference.',
    timeComplexity: 'O(N log N) using Timsort',
    spaceComplexity: 'O(log N) or O(N) internal stack',
    description: 'Sorts elements of an array. IMPORTANT: Default sort converts elements to strings!',
    snippet: `const nums = [10, 5, 40, 25, 1000];

// Note: nums.sort() gives [10, 1000, 25, 40, 5] (alphabetical)
// Numeric sort:
nums.sort((a, b) => a - b); // Ascending: [5, 10, 25, 40, 1000]
nums.sort((a, b) => b - a); // Descending

// Multi-attribute sorting (e.g., sort by start time, then end time):
intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);`,
    edgeCasesNotes: 'Always pass a comparator `(a, b) => a - b` when sorting numbers! Without it, 1000 sorts before 25.',
    tags: ['sort', 'comparator', 'numeric', 'in-place', 'timsort']
  },
  {
    id: 'js-binary-search-pattern',
    name: 'Binary Search Pattern',
    category: 'sorting_searching',
    language: 'javascript',
    signature: 'binarySearch(arr, target) -> index or insertion point',
    mutatesVsReturns: 'Pure search algorithm. Does NOT mutate input array.',
    timeComplexity: 'O(log N)',
    spaceComplexity: 'O(1)',
    description: 'Standard bisect / binary search template avoiding integer overflow.',
    snippet: `function binarySearch(arr: number[], target: number): number {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    // Avoids integer overflow:
    const mid = left + Math.floor((right - left) / 2);

    if (arr[mid] === target) {
      return mid; // Target found
    } else if (arr[mid] < target) {
      left = mid + 1; // Search right half
    } else {
      right = mid - 1; // Search left half
    }
  }

  return -1; // Not found (left is insertion point)
}`,
    edgeCasesNotes: 'Input must be sorted. Mid calculation `left + Math.floor((right - left) / 2)` prevents 32-bit overflow.',
    tags: ['binary search', 'search', 'logarithmic', 'bisect']
  },

  // ===================== STANDARD I/O & PARSING =====================
  {
    id: 'js-json-io-parsing',
    name: 'JSON & Input Parsing Helpers',
    category: 'io_parsing',
    language: 'javascript',
    signature: 'JSON.parse(str) | parseInt(str, 10) | parseFloat(str)',
    mutatesVsReturns: 'Returns newly parsed JavaScript object or number.',
    timeComplexity: 'O(N) where N is length of string',
    spaceComplexity: 'O(N) for constructed object tree',
    description: 'Safely parse structured input strings, test case payloads, or multi-line feeds.',
    snippet: `// Safely parse integer with radix:
const num = parseInt("42px", 10); // 42

// Parse space-separated numbers on a single line:
const line = "12 45 78 99";
const parsed = line.trim().split(/\\s+/).map(Number); // [12, 45, 78, 99]

// Deep clone simple objects/arrays (offline fast copy):
const clone = structuredClone(originalData);`,
    edgeCasesNotes: 'Always specify radix 10 with parseInt to avoid octal confusion on legacy inputs.',
    tags: ['json', 'parse', 'stdin', 'string-to-number', 'structuredClone']
  },
  {
    id: 'py-io-parsing',
    name: 'Python sys.stdin & String Stripping',
    category: 'io_parsing',
    language: 'python',
    signature: 'import sys | sys.stdin.read().splitlines() | list(map(int, input().split()))',
    mutatesVsReturns: 'Reads input stream and produces fresh Python strings or integers.',
    timeComplexity: 'O(N) input size',
    spaceComplexity: 'O(N) tokens',
    description: 'Fast I/O parsing techniques for competitive algorithms and automated test runners.',
    snippet: `import sys

# Fast read all lines at once
lines = sys.stdin.read().splitlines()

# Read line of integers
nums = list(map(int, input().split()))

# Split into lines and strip trailing whitespace
cleaned_lines = [line.strip() for line in sys.stdin if line.strip()]`,
    edgeCasesNotes: 'sys.stdin.read() reads entire buffer until EOF, ideal for batch offline test evaluation.',
    tags: ['python', 'io', 'stdin', 'parsing', 'fast-io']
  }
];

export const CATEGORY_LABELS: Record<string, { label: string; iconName: string }> = {
  all: { label: 'All Manuals', iconName: 'BookOpen' },
  arrays: { label: 'Arrays & Lists', iconName: 'Layers' },
  objects_maps: { label: 'Maps & Sets', iconName: 'Hash' },
  strings: { label: 'String Manipulation', iconName: 'Type' },
  math: { label: 'Math & Heap', iconName: 'Calculator' },
  sorting_searching: { label: 'Sorting & Searching', iconName: 'ArrowUpDown' },
  io_parsing: { label: 'I/O & Parsing', iconName: 'FileText' },
};
