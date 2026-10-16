export class MinHeap {
  
  // Constructor
  constructor() {
    this.heap = [];
  }

  // Tests if the queue is empty
  isEmpty() {
    return this.heap.length === 0;
  }
  
  // Returns the top node of the priority queue without removal
  peek() {
    return this.heap.length === 0 ? null : this.heap[0];
  }

  // Get parent index of a node at the provided index
  getParentIndex(index) {
    return Math.floor((index - 1) / 2);
  }

  // Get the left child index of a node at the provided index
  getLeftChildIndex(index) {
    return (2 * index) + 1;
  }

  // Get the right child index of a node at the provided index
  getRightChildIndex(index) {
    return (2 * index) + 2;
  }

  // Swaps positions of node at index1 and node at index2
  swap(index1, index2) {
    let temp = this.heap[index1];
    this.heap[index1] = this.heap[index2];
    this.heap[index2] = temp;
  }

  // Enqueues a node with a numerical priority
  enqueue(node, priority) {
    this.remove(node);
    this.heap.push([node, priority]);
    this.heapifyUp(this.heap.length - 1);
  }

  // Resort the priority queue to retain the min heap property
  heapifyUp(index) {
    while (index > 0) {
      let parentIndex = this.getParentIndex(index);
      if (this.heap[index][1] < this.heap[parentIndex][1]) {
        this.swap(index, parentIndex);
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  // Removes the top node of the priority queue 
  dequeue() {
    if (this.heap.length === 0) return null;

    // Swap the first node with the last one
    // then remove the last node
    let data = this.heap[0][0];
    this.heap[0] = this.heap[this.heap.length - 1];
    this.heap.pop();

    this.heapifyDown(0); 
    return data; 
  }

  // Resort the priority queue to retain the min heap property
  heapifyDown(index) {
    while (true) {
      let leftChildIndex = this.getLeftChildIndex(index);
      let rightChildIndex = this.getRightChildIndex(index);
      let smallest = index;

      if (leftChildIndex < this.heap.length &&
        this.heap[leftChildIndex][1] < this.heap[smallest][1]) {
        smallest = leftChildIndex;
      }
      if (rightChildIndex < this.heap.length &&
        this.heap[rightChildIndex][1] < this.heap[smallest][1]) {
        smallest = rightChildIndex;
      }
      if (smallest !== index) {
        this.swap(index, smallest);
        index = smallest;
      } else {
        break;
      }
    }
  }

  // Find and remove a node from the heap
  remove(node) {
    let index = this.findIndex(node);
    // Node is not in heap
    if (index === -1) return;

    // Swap with last node and remove
    this.swap(index, this.heap.length - 1);
    this.heap.pop();

    // Re-heapify from removed index
    if (index < this.heap.length) {
      this.heapifyDown(index);
      this.heapifyUp(index);
    }
  }

  // Find node index in the heap
  findIndex(node) {
    for (let i = 0; i < this.heap.length; i++) {
      if (this.heap[i][0] === node) return i;
    }
    return -1;
  }
}