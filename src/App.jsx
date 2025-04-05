import React, { useState, useEffect } from 'react';

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [collections, setCollections] = useState({});
  const [activeCollection, setActiveCollection] = useState("default");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [sortOrder, setSortOrder] = useState("title");

  const perPage = 10;

  useEffect(() => {
    if (!collections["default"]) {
      setCollections({ ...collections, default: [] });
    }
  }, []);

  useEffect(() => {
    if (query.trim() !== "") {
      search();
    }
  }, [sortOrder]);

  const cleanDate = (rawDate) => {
    const cleaned = parseInt((rawDate || "").toString().replace(/[^0-9]/g, ""));
    return isNaN(cleaned) ? null : cleaned;
  };

  const fetchFromMet = async (q) => {
    const res = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/search?q=${q}&hasImages=true`);
    const data = await res.json();
    const ids = data.objectIDs?.slice(0, 30) || [];

    const objects = await Promise.all(
      ids.map(id =>
        fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`).then(r => r.json())
      )
    );

    return objects
      .filter(obj => obj.primaryImageSmall && obj.title.toLowerCase().includes(q.toLowerCase()))
      .map(obj => ({
        id: `met-${obj.objectID}`,
        title: obj.title,
        artist: obj.artistDisplayName,
        image: obj.primaryImageSmall,
        source: "The Met",
        date: cleanDate(obj.objectDate),
        rawDate: obj.objectDate || "Unknown"
      }));
  };

  const fetchFromCleveland = async (q) => {
    const res = await fetch(`https://openaccess-api.clevelandart.org/api/artworks?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    return data.data
      .filter(item => item.title.toLowerCase().includes(q.toLowerCase()))
      .map(item => ({
        id: `cleveland-${item.id}`,
        title: item.title,
        artist: item.creators?.[0]?.description || "Unknown",
        image: item.images?.web?.url || null,
        source: "Cleveland Museum of Art",
        date: cleanDate(item.creation_date_earliest || item.creation_date),
        rawDate: item.creation_date || item.creation_date_earliest || "Unknown"
      }));
  };

  const sortResults = (items) => {
    return [...items].sort((a, b) => {
      if (sortOrder === "title") {
        return a.title.localeCompare(b.title);
      } else if (sortOrder === "newest") {
        return (b.date || 0) - (a.date || 0);
      } else if (sortOrder === "oldest") {
        return (a.date || Infinity) - (b.date || Infinity);
      }
      return 0;
    });
  };

  const search = async () => {
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const [metResults, clevelandResults] = await Promise.all([
        fetchFromMet(query),
        fetchFromCleveland(query)
      ]);
      const combined = sortResults([...metResults, ...clevelandResults]);
      setResults(combined);
      setPage(1);
    } catch (e) {
      console.error(e);
      setError("Error fetching artworks.");
    } finally {
      setLoading(false);
    }
  };

  const paginatedResults = results.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(results.length / perPage);

  const addToCollection = (item) => {
    const current = collections[activeCollection] || [];
    setCollections({
      ...collections,
      [activeCollection]: [...current, item]
    });
  };

  const removeFromCollection = (id) => {
    const filtered = collections[activeCollection].filter(item => item.id !== id);
    setCollections({
      ...collections,
      [activeCollection]: filtered
    });
  };

  const createCollection = (name) => {
    if (!collections[name]) {
      setCollections({ ...collections, [name]: [] });
      setActiveCollection(name);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      search();
    }
  };

  return (
    <main className="container">
      <h1>Exhibition Curator MVP</h1>

      <section className="search-section">
      <input
        id="search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search artworks…"
        aria-label="Search artworks"
        />
        <button onClick={search}>Search</button>
        {error && <p role="alert" className="error">{error}</p>}
      </section>

      <section className="sort-section">
        <label htmlFor="sort">Sort by:</label>
        <select id="sort" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
          <option value="title">Alphabetical</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </section>

      {loading && <p className="loading">Loading...</p>}

        {!loading && results.length === 0 && query.trim() !== "" && (
        <p className="loading">No artworks found.</p>
        )}

      <section aria-label="Search results">
        <ul>
          {paginatedResults.map(item => (
            <li key={item.id} className="card">
              {item.image && <img src={item.image} alt={item.title} />}
              <div className="card-info">
                <strong>{item.title}</strong>
                <p>{item.artist}</p>
                <p className="source-label">{item.source}</p>
                {item.rawDate && <p className="source-label">{item.rawDate}</p>}
                <button onClick={() => addToCollection(item)}>Add to Collection</button>
              </div>
            </li>
          ))}
        </ul>
        {results.length > perPage && (
          <div className="pagination">
            <button onClick={() => setPage(Math.max(1, page - 1))}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(page * perPage < results.length ? page + 1 : page)}>Next</button>
          </div>
        )}
      </section>

      <section className="collections-section">
        <div className="collection-controls">
          <input
            id="new-collection"
            type="text"
            placeholder="New collection name"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
          />
          <button onClick={() => createCollection(newCollectionName)}>Add Collection</button>
        </div>
        <div className="collection-buttons">
          {Object.keys(collections).map((key) => (
            <button
              key={key}
              onClick={() => setActiveCollection(key)}
              className={`collection-button${key === activeCollection ? " active" : ""}`}
            >
              {key}
            </button>
          ))}
        </div>
      </section>

      <section>
        <ul>
          {(collections[activeCollection] || []).map(item => (
            <li key={item.id} className="card">
              {item.image && <img src={item.image} alt={item.title} />}
              <div className="card-info">
                <strong>{item.title}</strong>
                <p>{item.artist}</p>
                <button onClick={() => removeFromCollection(item.id)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
