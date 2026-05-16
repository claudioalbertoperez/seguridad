import { useEffect, useMemo, useRef, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:4000/api";

const priorityLabel = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const roleCopy = {
  inspector: {
    title: "Ingreso de casos en terreno",
    description:
      "Registra fiscalizaciones, completa antecedentes y genera un nuevo caso para seguimiento municipal.",
  },
  supervisor: {
    title: "Dashboard de supervision",
    description:
      "Monitorea indicadores, casos activos, sincronizacion y trazabilidad operacional.",
  },
};

const initialForm = {
  category: "ruidos",
  priority: "medium",
  zone: "",
  address: "",
  summary: "",
  mode: "online",
  channel: "foto",
  source: "camera",
  location: null,
  attachment: null,
};

function App() {
  const videoPreviewRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [inspectorView, setInspectorView] = useState("new-case");
  const [session, setSession] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginStatus, setLoginStatus] = useState({ loading: false, error: "" });
  const [dashboard, setDashboard] = useState(null);
  const [cases, setCases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("todos");
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [status, setStatus] = useState({ loading: false, error: "" });
  const [caseForm, setCaseForm] = useState(initialForm);
  const [caseFormStatus, setCaseFormStatus] = useState({
    loading: false,
    error: "",
    success: "",
  });
  const [geoStatus, setGeoStatus] = useState({
    loading: false,
    error: "",
    success: "",
  });
  const [addressStatus, setAddressStatus] = useState({
    loading: false,
    error: "",
    success: "",
  });
  const [cameraStatus, setCameraStatus] = useState({
    loading: false,
    error: "",
    success: "",
  });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!session) {
      return;
    }

    async function loadData() {
      try {
        setStatus({ loading: true, error: "" });

        const [dashboardRes, casesRes, categoriesRes] = await Promise.all([
          fetch(`${API_URL}/dashboard`),
          fetch(`${API_URL}/cases`),
          fetch(`${API_URL}/categories`),
        ]);

        if (!dashboardRes.ok || !casesRes.ok || !categoriesRes.ok) {
          throw new Error("No fue posible cargar la plataforma.");
        }

        const dashboardData = await dashboardRes.json();
        const casesData = await casesRes.json();
        const categoriesData = await categoriesRes.json();

        setDashboard(dashboardData);
        setCases(casesData);
        setCategories(categoriesData);
        setSelectedCaseId(casesData[0]?.id ?? null);
        setStatus({ loading: false, error: "" });
      } catch (error) {
        setStatus({
          loading: false,
          error:
            "La API local no esta disponible. Inicia el backend para cargar datos reales.",
        });
      }
    }

    loadData();
  }, [session]);

  useEffect(() => {
    if (!cameraOpen || !videoPreviewRef.current || !mediaStreamRef.current) {
      return;
    }

    videoPreviewRef.current.srcObject = mediaStreamRef.current;
  }, [cameraOpen]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const visibleCases = useMemo(() => {
    if (selectedFilter === "alta") {
      return cases.filter((item) => item.priority === "high");
    }

    if (selectedFilter === "offline") {
      return cases.filter((item) => item.mode === "offline");
    }

    return cases;
  }, [cases, selectedFilter]);

  const selectedCase =
    visibleCases.find((item) => item.id === selectedCaseId) ??
    visibleCases[0] ??
    null;

  useEffect(() => {
    if (!selectedCase && visibleCases[0]) {
      setSelectedCaseId(visibleCases[0].id);
    }
  }, [selectedCase, visibleCases]);

  async function handleLogin(event) {
    event.preventDefault();

    try {
      setLoginStatus({ loading: true, error: "" });

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No fue posible iniciar sesion.");
      }

      setSession(data);
      setLoginStatus({ loading: false, error: "" });
      setLoginForm({ username: "", password: "" });
    } catch (error) {
      setLoginStatus({
        loading: false,
        error: error.message || "Error inesperado de autenticacion.",
      });
    }
  }

  function handleLogout() {
    stopCameraStream();
    setSession(null);
    setDashboard(null);
    setCases([]);
    setCategories([]);
    setSelectedFilter("todos");
    setSelectedCaseId(null);
    setInspectorView("new-case");
    setStatus({ loading: false, error: "" });
    setLoginStatus({ loading: false, error: "" });
    setLoginForm({ username: "", password: "" });
    setCaseForm(initialForm);
    setCaseFormStatus({ loading: false, error: "", success: "" });
    setGeoStatus({ loading: false, error: "", success: "" });
    setAddressStatus({ loading: false, error: "", success: "" });
    setCameraStatus({ loading: false, error: "", success: "" });
    window.location.hash = "";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function handleCreateCase(event) {
    event.preventDefault();

    try {
      setCaseFormStatus({ loading: true, error: "", success: "" });

      const attachment = caseForm.attachment
        ? await readFileAsDataUrl(caseForm.attachment)
        : null;

      const response = await fetch(`${API_URL}/cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...caseForm,
          inspector: session.user.name,
          attachment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "No se pudo crear el caso.");
      }

      setCases((current) => [data, ...current]);
      setSelectedCaseId(data.id);
      setInspectorView("records");
      setCaseForm(initialForm);
      setCaseFormStatus({
        loading: false,
        error: "",
        success: `Caso ${data.id} ingresado correctamente.`,
      });
      setGeoStatus({ loading: false, error: "", success: "" });
      setAddressStatus({ loading: false, error: "", success: "" });
      setCameraStatus({ loading: false, error: "", success: "" });
      stopCameraStream();
    } catch (error) {
      setCaseFormStatus({
        loading: false,
        error: error.message || "Error al guardar el caso.",
        success: "",
      });
    }
  }

  function handleAttachmentChange(event) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setCaseForm((current) => ({ ...current, attachment: null }));
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setCaseFormStatus({
        loading: false,
        error: "Solo se permiten archivos de imagen o video.",
        success: "",
      });
      event.target.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setCaseFormStatus({
        loading: false,
        error: "El archivo excede el limite de 20 MB.",
        success: "",
      });
      event.target.value = "";
      return;
    }

    setCaseFormStatus({ loading: false, error: "", success: "" });
    setCaseForm((current) => ({ ...current, attachment: file }));
    setCameraStatus({ loading: false, error: "", success: "" });
  }

  function handleChannelChange(value) {
    stopCameraStream();
    setCaseForm((current) => ({
      ...current,
      channel: value,
      source: value === "audio" ? "gallery" : current.source,
      attachment: null,
    }));
  }

  function requestGeolocation() {
    if (!navigator.geolocation) {
      setGeoStatus({
        loading: false,
        error: "Este dispositivo no soporta geolocalizacion.",
        success: "",
      });
      return;
    }

    setGeoStatus({ loading: true, error: "", success: "" });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
          capturedAt: new Date().toISOString(),
        };

        setCaseForm((current) => ({
          ...current,
          location: nextLocation,
        }));
        setGeoStatus({
          loading: false,
          error: "",
          success: "Ubicacion capturada correctamente.",
        });
        setAddressStatus({ loading: false, error: "", success: "" });
      },
      (error) => {
        setGeoStatus({
          loading: false,
          error: geolocationErrorMessage(error),
          success: "",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  async function lookupAddressFromLocation() {
    if (!caseForm.location) {
      setAddressStatus({
        loading: false,
        error: "Primero debes capturar la ubicacion del dispositivo.",
        success: "",
      });
      return;
    }

    try {
      setAddressStatus({ loading: true, error: "", success: "" });

      const { latitude, longitude } = caseForm.location;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("No fue posible consultar la direccion.");
      }

      const data = await response.json();
      const resolvedAddress = buildAddressFromReverseGeocode(data);
      const resolvedZone = buildZoneFromReverseGeocode(data);

      if (!resolvedAddress) {
        throw new Error("No se encontro una direccion util para esta ubicacion.");
      }

      setCaseForm((current) => ({
        ...current,
        address: resolvedAddress,
        zone: current.zone || resolvedZone,
      }));
      setAddressStatus({
        loading: false,
        error: "",
        success: "Direccion encontrada y completada automaticamente.",
      });
    } catch (error) {
      setAddressStatus({
        loading: false,
        error:
          error.message ||
          "No se pudo obtener la direccion automatica desde la ubicacion.",
        success: "",
      });
    }
  }

  async function openDeviceCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus({
        loading: false,
        error: "Este navegador no permite abrir la camara del dispositivo.",
        success: "",
      });
      return;
    }

    try {
      stopCameraStream();
      setCameraStatus({ loading: true, error: "", success: "" });

      const stream = await navigator.mediaDevices.getUserMedia({
        video:
          caseForm.channel === "foto" || caseForm.channel === "video"
            ? { facingMode: { ideal: "environment" } }
            : false,
        audio: caseForm.channel === "video",
      });

      mediaStreamRef.current = stream;
      setCameraOpen(true);
      setCameraStatus({
        loading: false,
        error: "",
        success:
          caseForm.channel === "video"
            ? "Camara y microfono listos para grabar video."
            : "Camara lista para capturar foto.",
      });
    } catch (error) {
      setCameraOpen(false);
      setCameraStatus({
        loading: false,
        error: "No fue posible abrir la camara del dispositivo.",
        success: "",
      });
    }
  }

  function stopCameraStream() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }

    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    setCameraOpen(false);
    setIsRecording(false);
  }

  async function capturePhotoFromCamera() {
    if (!videoPreviewRef.current) {
      setCameraStatus({
        loading: false,
        error: "La previsualizacion de camara no esta disponible.",
        success: "",
      });
      return;
    }

    const video = videoPreviewRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const context = canvas.getContext("2d");

    if (!context) {
      setCameraStatus({
        loading: false,
        error: "No se pudo procesar la captura de foto.",
        success: "",
      });
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));

    if (!blob) {
      setCameraStatus({
        loading: false,
        error: "No se pudo generar la imagen capturada.",
        success: "",
      });
      return;
    }

    const file = new File([blob], `captura-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });

    setCaseForm((current) => ({
      ...current,
      attachment: file,
    }));
    setCameraStatus({
      loading: false,
      error: "",
      success: "Foto capturada desde la camara del dispositivo.",
    });
    stopCameraStream();
  }

  function startVideoRecording() {
    if (!mediaStreamRef.current || typeof MediaRecorder === "undefined") {
      setCameraStatus({
        loading: false,
        error: "Este navegador no soporta grabacion de video.",
        success: "",
      });
      return;
    }

    try {
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(mediaStreamRef.current, {
        mimeType: "video/webm",
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const file = new File([blob], `video-${Date.now()}.webm`, {
          type: "video/webm",
        });

        setCaseForm((current) => ({
          ...current,
          attachment: file,
        }));
        setCameraStatus({
          loading: false,
          error: "",
          success: "Video grabado desde la camara del dispositivo.",
        });
        stopCameraStream();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setCameraStatus({
        loading: false,
        error: "",
        success: "Grabando video desde la camara del dispositivo.",
      });
    } catch (error) {
      setCameraStatus({
        loading: false,
        error: "No fue posible iniciar la grabacion de video.",
        success: "",
      });
    }
  }

  function stopVideoRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  if (!session) {
    return (
      <div className="auth-shell">
        <section className="auth-panel">
          <div>
            <p className="eyebrow">Plataforma Movil de Seguridad Municipal</p>
            <h1>Acceso por perfil</h1>
            <p className="auth-copy">
              Ingresa como inspector municipal para registrar un caso o como
              supervisor para revisar el dashboard operativo.
            </p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Usuario
              <input
                type="text"
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                placeholder="inspector o supervisor"
                required
              />
            </label>
            <label>
              Clave
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="login"
                required
              />
            </label>
            {loginStatus.error ? (
              <div className="banner error">{loginStatus.error}</div>
            ) : null}
            <button className="primary-btn full-width" type="submit">
              {loginStatus.loading ? "Ingresando..." : "Iniciar sesion"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <h1>Plataforma Movil de Seguridad Municipal</h1>
          <p className="sidebar-copy">
            {roleCopy[session.user.role].description}
          </p>
        </div>

        <nav className="nav">
          {session.user.role === "supervisor" ? (
            <>
              <a className="nav-link active" href="#dashboard">
                Dashboard
              </a>
              <a className="nav-link" href="#casos">
                Casos
              </a>
              <a className="nav-link" href="#operacion">
                Operacion
              </a>
              <a className="nav-link" href="#actas">
                Actas
              </a>
            </>
          ) : (
            <>
              <button
                className={`nav-link nav-button nav-button-new-case ${inspectorView === "new-case" ? "active" : ""}`}
                type="button"
                onClick={() => setInspectorView("new-case")}
              >
                <span className="nav-icon" aria-hidden="true">▤✎</span>
                <span>Ingresar caso</span>
              </button>
              <button
                className={`nav-link nav-button nav-button-records ${inspectorView === "records" ? "active" : ""}`}
                type="button"
                onClick={() => setInspectorView("records")}
              >
                <span className="nav-icon" aria-hidden="true">≡</span>
                <span>Mis casos</span>
              </button>
              <button
                className={`nav-link nav-button nav-button-detail ${inspectorView === "record-detail" ? "active" : ""}`}
                type="button"
                onClick={() => setInspectorView("record-detail")}
              >
                <span className="nav-icon" aria-hidden="true">⌕</span>
                <span>Actas</span>
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-card">
          <div>
            <strong>{session.user.name}</strong>
            <p>{session.user.title}</p>
            <button className="logout-btn" type="button" onClick={handleLogout}>
              <span className="logout-icon" aria-hidden="true">X</span>
              <span>Cerrar sesion</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <section className="hero" id={session.user.role === "supervisor" ? "dashboard" : "nuevo-caso"}>
          <div>
            <p className="eyebrow">{session.user.title}</p>
            <h2>
              {session.user.role === "inspector"
                ? inspectorHero(inspectorView).title
                : roleCopy[session.user.role].title}
            </h2>
            <p className="hero-copy">
              {session.user.role === "inspector"
                ? inspectorHero(inspectorView).description
                : roleCopy[session.user.role].description}
            </p>
          </div>

          {session.user.role === "supervisor" ? (
            <div className="hero-actions">
              <button className="primary-btn" type="button">
                Crear operativo
              </button>
              <button className="secondary-btn" type="button">
                Exportar reporte
              </button>
            </div>
          ) : null}
        </section>

        {status.error ? <div className="banner error">{status.error}</div> : null}

        {session.user.role === "inspector" ? (
          <>
            {inspectorView === "new-case" ? (
              <section className="single-panel-layout">
                <article className="panel">
                  <div className="panel-head">
                    <div>
                      <p className="eyebrow">Nuevo caso</p>
                      <h3>Ingreso de fiscalizacion</h3>
                    </div>
                  </div>

                  <form className="case-form" onSubmit={handleCreateCase}>
                <div className="form-section full-span">
                  <p className="section-kicker">Paso 1</p>
                  <h4>Tipo y contexto</h4>
                </div>
                <label>
                  Tipo de caso
                  <select
                    value={caseForm.category}
                    onChange={(event) =>
                      setCaseForm((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                  >
                    {categories.map((item) => (
                      <option key={item.slug} value={item.slug}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Prioridad
                  <select
                    value={caseForm.priority}
                    onChange={(event) =>
                      setCaseForm((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                  >
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                </label>

                <label>
                  Zona
                  <input
                    type="text"
                    value={caseForm.zone}
                    onChange={(event) =>
                      setCaseForm((current) => ({
                        ...current,
                        zone: event.target.value,
                      }))
                    }
                    placeholder="Ej. Santiago Centro"
                    required
                  />
                </label>

                <label>
                  Direccion
                  <input
                    type="text"
                    value={caseForm.address}
                    onChange={(event) =>
                      setCaseForm((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    placeholder="Ej. Av. Libertador 1234"
                    required
                  />
                </label>

                <label>
                  Canal principal
                  <select
                    value={caseForm.channel}
                    onChange={(event) => handleChannelChange(event.target.value)}
                  >
                    <option value="foto">Foto</option>
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                  </select>
                </label>

                <label>
                  Modo
                  <select
                    value={caseForm.mode}
                    onChange={(event) =>
                      setCaseForm((current) => ({
                        ...current,
                        mode: event.target.value,
                      }))
                    }
                  >
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>
                </label>

                <div className="form-section full-span">
                  <p className="section-kicker">Paso 2</p>
                  <h4>Ubicacion en terreno</h4>
                </div>

                <div className="geo-card">
                  <span className="detail-label">Georreferenciacion</span>
                  <div className="geo-actions">
                    <button
                      className="action-btn action-btn-location"
                      type="button"
                      onClick={requestGeolocation}
                    >
                      <span className="action-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="action-icon-svg">
                          <path
                            d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="12" cy="11" r="2.5" fill="currentColor" />
                        </svg>
                      </span>
                      <span className="action-copy">
                        <strong>
                          {geoStatus.loading ? "Obteniendo..." : "Usar ubicacion"}
                        </strong>
                        <small>Capturar GPS actual</small>
                      </span>
                    </button>
                    <button
                      className="action-btn action-btn-address"
                      type="button"
                      onClick={lookupAddressFromLocation}
                    >
                      <span className="action-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="action-icon-svg">
                          <path
                            d="M4 10.5 12 4l8 6.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M6.5 9.5V20h11V9.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M10 20v-5h4v5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="action-copy">
                        <strong>
                          {addressStatus.loading ? "Buscando..." : "Buscar direccion"}
                        </strong>
                        <small>Autocompletar desde GPS</small>
                      </span>
                    </button>
                  </div>
                  {caseForm.location ? (
                    <div className="geo-values">
                      <span>Lat: {caseForm.location.latitude}</span>
                      <span>Lng: {caseForm.location.longitude}</span>
                      <span>Precision: {caseForm.location.accuracy} m</span>
                    </div>
                  ) : (
                    <p className="helper-copy">Captura la posicion GPS al momento de registrar el caso.</p>
                  )}
                </div>

                <div className="form-section full-span">
                  <p className="section-kicker">Paso 3</p>
                  <h4>Descripcion y evidencia</h4>
                </div>

                <label className="full-span">
                  Resumen del caso
                  <textarea
                    rows="5"
                    value={caseForm.summary}
                    onChange={(event) =>
                      setCaseForm((current) => ({
                        ...current,
                        summary: event.target.value,
                      }))
                    }
                    placeholder="Describe lo observado por el inspector municipal."
                    required
                  />
                </label>

                <label>
                  Origen de evidencia
                  <select
                    value={caseForm.source}
                    onChange={(event) =>
                      setCaseForm((current) => ({
                        ...current,
                        source: event.target.value,
                      }))
                    }
                    disabled={caseForm.channel === "audio"}
                  >
                    <option value="camera">Camara del dispositivo</option>
                    <option value="gallery">Galeria o archivos</option>
                  </select>
                </label>

                <label className="full-span">
                  Evidencia adjunta
                  {caseForm.source === "camera" && caseForm.channel !== "audio" ? (
                    <div className="camera-card">
                      <div className="camera-actions">
                        {!cameraOpen ? (
                          <button
                            className="action-btn action-btn-camera"
                            type="button"
                            onClick={openDeviceCamera}
                          >
                            <span className="action-icon" aria-hidden="true">
                              <svg viewBox="0 0 24 24" className="action-icon-svg">
                                <path
                                  d="M4.5 8.5h3l1.4-2h6.2l1.4 2h3A1.5 1.5 0 0 1 21 10v8.5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5V10a1.5 1.5 0 0 1 1.5-1.5Z"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <circle
                                  cx="12"
                                  cy="14"
                                  r="3.2"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                />
                              </svg>
                            </span>
                            <span className="action-copy">
                              <strong>Abrir camara</strong>
                              <small>Captura desde dispositivo</small>
                            </span>
                          </button>
                        ) : null}
                        {cameraOpen && caseForm.channel === "foto" ? (
                          <>
                            <button
                              className="primary-btn"
                              type="button"
                              onClick={capturePhotoFromCamera}
                            >
                              Capturar foto
                            </button>
                            <button
                              className="secondary-btn"
                              type="button"
                              onClick={stopCameraStream}
                            >
                              Cerrar camara
                            </button>
                          </>
                        ) : null}
                        {cameraOpen && caseForm.channel === "video" && !isRecording ? (
                          <>
                            <button
                              className="primary-btn"
                              type="button"
                              onClick={startVideoRecording}
                            >
                              Iniciar grabacion
                            </button>
                            <button
                              className="secondary-btn"
                              type="button"
                              onClick={stopCameraStream}
                            >
                              Cerrar camara
                            </button>
                          </>
                        ) : null}
                        {cameraOpen && caseForm.channel === "video" && isRecording ? (
                          <button
                            className="primary-btn"
                            type="button"
                            onClick={stopVideoRecording}
                          >
                            Detener grabacion
                          </button>
                        ) : null}
                      </div>

                      {cameraOpen ? (
                        <video
                          ref={videoPreviewRef}
                          className="camera-preview"
                          autoPlay
                          muted
                          playsInline
                        />
                      ) : (
                        <p className="helper-copy">
                          Abre la camara para capturar una foto o grabar un video desde el dispositivo.
                        </p>
                      )}
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleAttachmentChange}
                    />
                  )}
                  <small className="field-hint">
                    {caseForm.channel === "audio"
                      ? "Actualmente esta version acepta imagen o video. Para audio dejamos el flujo preparado."
                      : caseForm.source === "camera"
                        ? "La captura se realiza usando la camara real del dispositivo."
                        : "Adjunta una imagen o video desde galeria o archivos, hasta 20 MB."}
                  </small>
                </label>

                {caseForm.attachment ? (
                  <div className="detail-block full-span">
                    <span className="detail-label">Archivo seleccionado</span>
                    <span className="detail-value">
                      {caseForm.attachment.name} - {formatBytes(caseForm.attachment.size)}
                    </span>
                  </div>
                ) : null}

                {geoStatus.error ? (
                  <div className="banner error full-span">{geoStatus.error}</div>
                ) : null}
                {geoStatus.success ? (
                  <div className="banner success full-span">{geoStatus.success}</div>
                ) : null}
                {addressStatus.error ? (
                  <div className="banner error full-span">{addressStatus.error}</div>
                ) : null}
                {addressStatus.success ? (
                  <div className="banner success full-span">{addressStatus.success}</div>
                ) : null}
                {cameraStatus.error ? (
                  <div className="banner error full-span">{cameraStatus.error}</div>
                ) : null}
                {cameraStatus.success ? (
                  <div className="banner success full-span">{cameraStatus.success}</div>
                ) : null}

                {caseFormStatus.error ? (
                  <div className="banner error full-span">{caseFormStatus.error}</div>
                ) : null}
                {caseFormStatus.success ? (
                  <div className="banner success full-span">{caseFormStatus.success}</div>
                ) : null}

                    <button className="primary-btn full-span" type="submit">
                      {caseFormStatus.loading ? "Guardando caso..." : "Ingresar caso"}
                    </button>
                  </form>
                </article>
              </section>
            ) : null}

            {inspectorView === "records" ? (
              <section className="single-panel-layout" id="casos">
                <article className="panel">
                  <div className="panel-head">
                    <div>
                      <p className="eyebrow">Mis casos</p>
                      <h3>Casos ingresados</h3>
                    </div>
                  </div>

                  <div className="case-list">
                    {status.loading ? <p>Cargando casos...</p> : null}
                    {!status.loading &&
                      cases
                        .filter((item) => item.inspector === session.user.name)
                        .map((item) => (
                          <button
                            className={`case-card ${selectedCase?.id === item.id ? "active" : ""}`}
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSelectedCaseId(item.id);
                              setInspectorView("record-detail");
                            }}
                          >
                            <div className="case-card-top">
                              <div>
                                <h4>{item.type}</h4>
                                <p>{item.summary}</p>
                              </div>
                              <span className={`priority ${item.priority}`}>
                                {priorityLabel[item.priority]}
                              </span>
                            </div>
                            <div className="case-card-bottom">
                              <span className="case-meta">
                                {item.id} - {item.zone}
                              </span>
                              <span className={`tag ${item.priority}`}>{item.mode}</span>
                            </div>
                          </button>
                        ))}
                  </div>
                </article>
              </section>
            ) : null}

            {inspectorView === "record-detail" ? (
              <section className="single-panel-layout" id="actas">
                <article className="panel">
                  <div className="panel-head">
                    <div>
                      <p className="eyebrow">Detalle</p>
                      <h3>Ficha del caso seleccionado</h3>
                    </div>
                    <button
                      className="secondary-btn"
                      type="button"
                      onClick={() => setInspectorView("records")}
                    >
                      Volver a mis casos
                    </button>
                  </div>
                  <CaseDetail selectedCase={selectedCase} />
                </article>
              </section>
            ) : null}
          </>
        ) : (
          <>
            <section className="metrics" id="indicadores">
              <MetricCard
                accent
                label="Casos activos"
                value={dashboard?.metrics.activeCases ?? "--"}
                note={dashboard?.metrics.activeCasesNote ?? "Cargando..."}
              />
              <MetricCard
                label="Actas emitidas"
                value={dashboard?.metrics.recordsIssued ?? "--"}
                note={dashboard?.metrics.recordsIssuedNote ?? "Cargando..."}
              />
              <MetricCard
                label="Tiempo promedio"
                value={dashboard?.metrics.averageResponseTime ?? "--"}
                note={dashboard?.metrics.averageResponseTimeNote ?? "Cargando..."}
              />
              <MetricCard
                label="Offline pendientes"
                value={dashboard?.metrics.pendingOffline ?? "--"}
                note={dashboard?.metrics.pendingOfflineNote ?? "Cargando..."}
              />
            </section>

            <section className="content-grid" id="casos">
              <article className="panel panel-wide">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Gestor de casos</p>
                    <h3>Incidencias recientes</h3>
                  </div>
                  <div className="filters">
                    <FilterChip
                      active={selectedFilter === "todos"}
                      onClick={() => setSelectedFilter("todos")}
                    >
                      Todos
                    </FilterChip>
                    <FilterChip
                      active={selectedFilter === "alta"}
                      onClick={() => setSelectedFilter("alta")}
                    >
                      Alta prioridad
                    </FilterChip>
                    <FilterChip
                      active={selectedFilter === "offline"}
                      onClick={() => setSelectedFilter("offline")}
                    >
                      Offline
                    </FilterChip>
                  </div>
                </div>

                <div className="case-list">
                  {status.loading ? <p>Cargando casos...</p> : null}
                  {!status.loading &&
                    visibleCases.map((item) => (
                      <button
                        className={`case-card ${selectedCase?.id === item.id ? "active" : ""}`}
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCaseId(item.id)}
                      >
                        <div className="case-card-top">
                          <div>
                            <h4>{item.type}</h4>
                            <p>{item.summary}</p>
                          </div>
                          <span className={`priority ${item.priority}`}>
                            {priorityLabel[item.priority]}
                          </span>
                        </div>
                        <div className="case-card-bottom">
                          <span className="case-meta">
                            {item.id} - {item.zone}
                          </span>
                          <span className={`tag ${item.priority}`}>{item.mode}</span>
                        </div>
                      </button>
                    ))}
                </div>
              </article>

              <article className="panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Vista territorial</p>
                    <h3>Mapa de calor operativo</h3>
                  </div>
                </div>

                <div className="map-card">
                  <div className="map-grid">
                    {dashboard?.heatmap?.map((level, index) => (
                      <span className={`heat ${level}`} key={`${level}-${index}`}></span>
                    )) ?? <p>Cargando mapa...</p>}
                  </div>
                  <div className="map-legend">
                    <span>
                      <i className="legend high"></i> Critico
                    </span>
                    <span>
                      <i className="legend mid"></i> Medio
                    </span>
                    <span>
                      <i className="legend low"></i> Bajo
                    </span>
                  </div>
                </div>
              </article>
            </section>

            <section className="content-grid" id="operacion">
              <article className="panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Canales de evidencia</p>
                    <h3>Captura soportada</h3>
                  </div>
                </div>

                <ul className="feature-list">
                  {dashboard?.evidenceChannels?.map((item) => (
                    <li key={item}>{item}</li>
                  )) ?? <li>Esperando datos de la API.</li>}
                </ul>
              </article>

              <article className="panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Tipos de fiscalizacion</p>
                    <h3>Casos de uso habilitados</h3>
                  </div>
                </div>

                <div className="category-grid">
                  {categories.map((item) => (
                    <div className="detail-block" key={item.slug}>
                      <span className="detail-label">{item.name}</span>
                      <p>{item.description}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel panel-tall" id="actas">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Acta digital</p>
                    <h3>Detalle del caso seleccionado</h3>
                  </div>
                </div>
                <CaseDetail selectedCase={selectedCase} />
              </article>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function inspectorHero(view) {
  if (view === "records") {
    return {
      title: "Mis casos registrados",
      description:
        "Revisa los casos ingresados por el inspector y selecciona uno para ver su detalle.",
    };
  }

  if (view === "record-detail") {
    return {
      title: "Acta y detalle del caso",
      description:
        "Consulta la ficha completa del caso seleccionado, incluyendo evidencia y georreferenciacion.",
    };
  }

  return {
    title: "Ingreso de casos en terreno",
    description:
      "Registra fiscalizaciones, completa antecedentes y genera un nuevo caso para seguimiento municipal.",
  };
}

function CaseDetail({ selectedCase }) {
  if (!selectedCase) {
    return <p>No hay casos disponibles para el filtro seleccionado.</p>;
  }

  return (
    <div className="case-detail">
      <div className="detail-grid">
        <DetailCard label="Folio" value={selectedCase.id} />
        <DetailCard label="Estado" value={selectedCase.status} />
        <DetailCard label="Inspector" value={selectedCase.inspector} />
        <DetailCard label="Zona" value={selectedCase.zone} />
      </div>

      <div className="detail-block">
        <span className="detail-label">Resumen operativo</span>
        <p>{selectedCase.summary}</p>
      </div>

      <div className="detail-grid">
        <DetailCard label="Direccion" value={selectedCase.address || "Sin direccion"} />
        <DetailCard label="Evidencia" value={selectedCase.evidence} />
      </div>

      <div className="detail-grid">
        <DetailCard label="Acta" value={selectedCase.acta} />
        <DetailCard label="Canal principal" value={selectedCase.channel} />
        <DetailCard label="Modo" value={selectedCase.mode} />
      </div>

      {selectedCase.location ? (
        <div className="detail-grid">
          <DetailCard
            label="Georreferenciacion"
            value={`${selectedCase.location.latitude}, ${selectedCase.location.longitude}`}
          />
          <DetailCard
            label="Precision"
            value={`${selectedCase.location.accuracy ?? "s/d"} m`}
          />
        </div>
      ) : null}

      {selectedCase.attachment ? (
        <div className="detail-block">
          <span className="detail-label">Archivo adjunto</span>
          <p>
            {selectedCase.attachment.name} - {selectedCase.attachment.kind}
          </p>
          {selectedCase.attachment.kind === "image" ? (
            <img
              className="evidence-preview"
              src={selectedCase.attachment.url}
              alt={selectedCase.attachment.name}
            />
          ) : (
            <video className="evidence-preview" controls src={selectedCase.attachment.url}>
              Tu navegador no soporta la reproduccion del video.
            </video>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ accent = false, label, value, note }) {
  return (
    <article className={`metric-card ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function FilterChip({ children, active, onClick }) {
  return (
    <button
      className={`chip ${active ? "active" : ""}`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DetailCard({ label, value }) {
  return (
    <div className="detail-block">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        kind: file.type.startsWith("image/") ? "image" : "video",
        dataUrl: reader.result,
      });
    };

    reader.onerror = () => {
      reject(new Error("No se pudo leer el archivo adjunto."));
    };

    reader.readAsDataURL(file);
  });
}

function geolocationErrorMessage(error) {
  if (error?.code === 1) {
    return "Se denego el permiso de ubicacion en el dispositivo.";
  }

  if (error?.code === 2) {
    return "No fue posible determinar la ubicacion actual.";
  }

  if (error?.code === 3) {
    return "La obtencion de ubicacion excedio el tiempo de espera.";
  }

  return "No se pudo capturar la georreferenciacion.";
}

function buildAddressFromReverseGeocode(data) {
  const address = data?.address ?? {};
  const road =
    address.road ||
    address.pedestrian ||
    address.footway ||
    address.path ||
    address.cycleway;
  const houseNumber = address.house_number;

  if (road && houseNumber) {
    return `${road} ${houseNumber}`;
  }

  if (road) {
    return road;
  }

  return data?.display_name?.split(",")?.slice(0, 2)?.join(", ") || "";
}

function buildZoneFromReverseGeocode(data) {
  const address = data?.address ?? {};

  return (
    address.suburb ||
    address.city_district ||
    address.town ||
    address.city ||
    address.county ||
    ""
  );
}

export default App;
