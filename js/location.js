/* Locality matching helpers based on saved addresses. */
(function () {
  function locality(address) {
    return String(address || '').split(',').map(part => part.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' '))
      .filter(Boolean).slice(-2);
  }

  function areaRank(a, b) {
    const left = locality(a), right = locality(b);
    if (!left.length || !right.length) return 2;
    if (left.length > 1 && right.length > 1 && left[left.length - 2] === right[right.length - 2]) return 0;
    if (left[left.length - 1] === right[right.length - 1]) return 1;
    return 2;
  }

  function sortByNearby(items, origin, locationOf) {
    return items.map((item, index) => {
      const target = locationOf(item) || {};
      return { item, index, area: areaRank(origin && origin.address, target.address) };
    }).sort((a, b) => a.area - b.area || a.index - b.index).map(row => row.item);
  }

  window.BizLocation = { areaRank, sortByNearby };
})();
