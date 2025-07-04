import React, { useState, useEffect, createContext, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';

// Contexto para o usuário e autenticação
const AuthContext = createContext(null);

// Inicializa o cliente Supabase
// As variáveis de ambiente __app_id, __firebase_config, __initial_auth_token não são mais usadas.
// Em um ambiente real, você obteria SUPABASE_URL e SUPABASE_ANON_KEY de variáveis de ambiente.
// Para o Canvas, usaremos placeholders e instruiremos o usuário a configurá-los.
const supabaseUrl = 'https://gvachraqsywxidemeqdd.supabase.co'; // Substitua pela sua URL do Supabase
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWNocmFxc3l3eGlkZW1lcWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2NTUzMjMsImV4cCI6MjA2NzIzMTMyM30.wYFu2LVG3mAQqShc947srzKIyz8WKpUpR4WOZhwqEQk'; // Substitua pela sua chave anon do Supabase

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Componente principal da aplicação
function App() {
  const [currentUser, setCurrentUser] = useState(null); // Supabase Auth user
  const [supabaseUser, setSupabaseUser] = useState(null); // User data from Supabase profiles table (role, isActive)
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [currentPage, setCurrentPage] = useState('login'); // Controla a página atual
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalCallback, setModalCallback] = useState(null);

  // Inicializa a autenticação e carrega os dados do perfil do usuário
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setCurrentUser(session.user);
        // Tenta buscar os dados do perfil do usuário no Supabase
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error && error.code === 'PGRST116') { // No rows found
          // Se o perfil não existe, cria um novo (primeiro login)
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              email: session.user.email,
              role: 'pending', // Padrão para novos usuários
              is_active: false, // Precisa ser ativado por um admin
            })
            .select()
            .single();

          if (insertError) {
            console.error("Erro ao criar perfil do usuário:", insertError);
            setSupabaseUser(null);
          } else {
            setSupabaseUser(newProfile);
          }
        } else if (error) {
          console.error("Erro ao carregar perfil do usuário:", error);
          setSupabaseUser(null);
        } else {
          setSupabaseUser(profile);
        }
      } else {
        setCurrentUser(null);
        setSupabaseUser(null);
      }
      setLoadingAuth(false);
    });

    // Tenta obter a sessão atual ao carregar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setLoadingAuth(false); // Se não há sessão, não estamos carregando autenticação
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Redireciona para a página inicial se autenticado e ativo
  useEffect(() => {
    if (!loadingAuth && currentUser && supabaseUser) {
      if (supabaseUser.is_active) {
        setCurrentPage('home');
      } else {
        // Usuário não ativo, mantém na tela de login/mensagem
        setModalMessage('Seu acesso ainda não foi liberado por um administrador. Por favor, aguarde.');
        setShowModal(true);
        setCurrentPage('login'); // Garante que a página de login seja exibida
      }
    } else if (!loadingAuth && !currentUser) {
      setCurrentPage('login');
    }
  }, [loadingAuth, currentUser, supabaseUser]);

  // Função para exibir o modal de mensagem
  const showInfoModal = (message, callback = null) => {
    setModalMessage(message);
    setModalCallback(() => callback); // Usa um callback para funções assíncronas ou de retorno
    setShowModal(true);
  };

  // Função para fechar o modal
  const closeModal = () => {
    setShowModal(false);
    setModalMessage('');
    if (modalCallback) {
      modalCallback(); // Executa o callback se houver
      setModalCallback(null);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setCurrentUser(null);
      setSupabaseUser(null);
      setCurrentPage('login');
      showInfoModal('Você foi desconectado.');
    } catch (error) {
      console.error("Erro ao fazer logout:", error.message);
      showInfoModal('Erro ao fazer logout. Tente novamente.');
    }
  };

  if (loadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Carregando...</div>
      </div>
    );
  }

  // Renderiza o componente de acordo com a página atual e o estado de autenticação
  return (
    <AuthContext.Provider value={{ supabase, currentUser, supabaseUser, showInfoModal }}>
      <div className="min-h-screen bg-gray-100 font-sans antialiased flex flex-col">
        {/* Modal de Mensagem */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full text-center">
              <p className="text-lg mb-4">{modalMessage}</p>
              <button
                onClick={closeModal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {currentUser && supabaseUser && supabaseUser.is_active && (
          <Header onNavigate={setCurrentPage} onLogout={handleLogout} supabaseUser={supabaseUser} />
        )}

        <main className="flex-grow p-4 md:p-8">
          {!currentUser || !supabaseUser || !supabaseUser.is_active ? (
            <LoginPage setCurrentUser={setCurrentUser} setSupabaseUser={setSupabaseUser} />
          ) : (
            <>
              {currentPage === 'home' && <HomePage onNavigate={setCurrentPage} />}
              {currentPage === 'products' && <ProductManagementPage />}
              {currentPage === 'entry' && <StockEntryPage />}
              {currentPage === 'exit' && <StockExitPage />}
              {currentPage === 'alerts' && <AlertsPage />}
              {currentPage === 'reports' && <ReportsPage />}
              {currentPage === 'user-management' && supabaseUser.role === 'admin' && <UserManagementPage />}
            </>
          )}
        </main>

        <Footer />
      </div>
    </AuthContext.Provider>
  );
}

// Componente de Cabeçalho
function Header({ onNavigate, onLogout, supabaseUser }) {
  const isAdmin = supabaseUser?.role === 'admin';
  const userId = supabaseUser?.id || 'N/A';

  return (
    <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-lg p-4">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
        <h1 className="text-3xl font-extrabold mb-2 md:mb-0">
          <button onClick={() => onNavigate('home')} className="hover:text-blue-200 transition-colors">
            Controle de Estoque Escolar
          </button>
        </h1>
        <nav className="flex flex-wrap justify-center md:justify-end gap-2 md:gap-4 text-lg">
          <button onClick={() => onNavigate('products')} className="nav-button">Produtos</button>
          <button onClick={() => onNavigate('entry')} className="nav-button">Entrada</button>
          <button onClick={() => onNavigate('exit')} className="nav-button">Saída</button>
          <button onClick={() => onNavigate('alerts')} className="nav-button">Alertas</button>
          <button onClick={() => onNavigate('reports')} className="nav-button">Relatórios</button>
          {isAdmin && (
            <button onClick={() => onNavigate('user-management')} className="nav-button">Gerenciar Usuários</button>
          )}
          <button onClick={onLogout} className="nav-button bg-red-600 hover:bg-red-700">Sair</button>
        </nav>
      </div>
      <div className="container mx-auto text-right text-sm mt-2">
        <span className="font-semibold">Usuário:</span> {userId} ({supabaseUser?.role === 'admin' ? 'Acesso Total' : 'Acesso Simples'})
      </div>
    </header>
  );
}

// Componente de Rodapé
function Footer() {
  return (
    <footer className="bg-gray-800 text-white text-center p-4 mt-8">
      <div className="container mx-auto">
        <p>&copy; {new Date().getFullYear()} Controle de Estoque Escolar. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}

// Componente da Página de Login
function LoginPage() {
  const { showInfoModal } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let authResponse;
      if (isRegistering) {
        authResponse = await supabase.auth.signUp({ email, password });
      } else {
        authResponse = await supabase.auth.signInWithPassword({ email, password });
      }

      const { user, error } = authResponse.data;

      if (error) throw error;

      if (user) {
        showInfoModal(isRegistering ? 'Registro realizado com sucesso! Aguarde a ativação do administrador.' : 'Login realizado com sucesso!');
      }
    } catch (error) {
      showInfoModal(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-160px)]">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">{isRegistering ? 'Registrar Nova Conta' : 'Fazer Login'}</h2>
        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-input"
            required
          />
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Carregando...' : (isRegistering ? 'Registrar' : 'Entrar')}
          </button>
        </form>
        <button
          onClick={() => setIsRegistering(!isRegistering)}
          className="mt-4 text-blue-600 hover:underline text-sm"
        >
          {isRegistering ? 'Já tem uma conta? Faça login' : 'Não tem uma conta? Registre-se'}
        </button>
        <p className="text-gray-600 mt-4 text-sm">
          Seu acesso será liberado por um administrador após o registro.
        </p>
      </div>
    </div>
  );
}


// Componente da Página Inicial
function HomePage({ onNavigate }) {
  return (
    <div className="text-center p-8 bg-white rounded-lg shadow-xl max-w-4xl mx-auto">
      <h2 className="text-4xl font-extrabold text-blue-800 mb-6">Painel Principal</h2>
      <p className="text-lg text-gray-700 mb-8">
        Bem-vindo ao sistema de controle de estoque de materiais escolares.
        Utilize os botões abaixo para navegar entre as funcionalidades.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardButton title="Gerenciar Produtos" icon="📦" onClick={() => onNavigate('products')} />
        <DashboardButton title="Registrar Entrada" icon="📥" onClick={() => onNavigate('entry')} />
        <DashboardButton title="Registrar Saída" icon="📤" onClick={() => onNavigate('exit')} />
        <DashboardButton title="Ver Alertas" icon="🔔" onClick={() => onNavigate('alerts')} />
        <DashboardButton title="Gerar Relatórios" icon="📊" onClick={() => onNavigate('reports')} />
      </div>
    </div>
  );
}

// Componente de Botão para o Dashboard
function DashboardButton({ title, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center p-6 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transform hover:scale-105 transition-all duration-300 ease-in-out group"
    >
      <span className="text-5xl mb-3 transition-transform group-hover:rotate-6">{icon}</span>
      <span className="text-xl font-semibold">{title}</span>
    </button>
  );
}


// Gerenciamento de Produtos
function ProductManagementPage() {
  const { supabase, supabaseUser, showInfoModal } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null); // Produto sendo editado
  const [newProduct, setNewProduct] = useState({ name: '', unit: '', quantity: 0, min_stock: 0, category: '' });
  const [categories, setCategories] = useState([]); // Lista de categorias únicas
  const isAdmin = supabaseUser?.role === 'admin';

  useEffect(() => {
    if (!supabase) return;

    const fetchProducts = async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (error) {
        console.error("Erro ao carregar produtos:", error.message);
        showInfoModal('Erro ao carregar produtos.');
      } else {
        setProducts(data);
        const uniqueCategories = [...new Set(data.map(p => p.category).filter(Boolean))];
        setCategories(uniqueCategories);
      }
    };

    fetchProducts();

    // Setup real-time subscription
    const subscription = supabase
      .channel('products_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        fetchProducts(); // Re-fetch products on any change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [supabase, showInfoModal]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewProduct(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!supabase || !isAdmin) {
      showInfoModal('Você não tem permissão para realizar esta ação.');
      return;
    }

    // Validação básica
    if (!newProduct.name || !newProduct.unit || newProduct.quantity < 0 || newProduct.min_stock < 0 || !newProduct.category) {
      showInfoModal('Por favor, preencha todos os campos obrigatórios (Nome, Unidade, Quantidade, Estoque Mínimo, Categoria) e garanta que quantidades não são negativas.');
      return;
    }

    try {
      if (editingProduct) {
        // Edição
        const { error } = await supabase
          .from('products')
          .update({
            name: newProduct.name,
            unit: newProduct.unit,
            quantity: Number(newProduct.quantity),
            min_stock: Number(newProduct.min_stock),
            category: newProduct.category,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
        showInfoModal('Produto atualizado com sucesso!');
      } else {
        // Novo produto
        const { error } = await supabase
          .from('products')
          .insert({
            name: newProduct.name,
            unit: newProduct.unit,
            quantity: Number(newProduct.quantity),
            min_stock: Number(newProduct.min_stock),
            category: newProduct.category,
          });

        if (error) throw error;
        showInfoModal('Produto adicionado com sucesso!');
      }
      setNewProduct({ name: '', unit: '', quantity: 0, min_stock: 0, category: '' });
      setEditingProduct(null);
    } catch (error) {
      console.error("Erro ao salvar produto:", error.message);
      showInfoModal('Erro ao salvar produto. Verifique os dados.');
    }
  };

  const handleEditProduct = (product) => {
    if (!isAdmin) {
      showInfoModal('Você não tem permissão para editar produtos.');
      return;
    }
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      unit: product.unit,
      quantity: product.quantity,
      min_stock: product.min_stock,
      category: product.category
    });
  };

  const handleDeleteProduct = async (productId) => {
    if (!supabase || !isAdmin) {
      showInfoModal('Você não tem permissão para excluir produtos.');
      return;
    }
    showInfoModal('Tem certeza que deseja excluir este produto? Esta ação é irreversível.', async () => {
      try {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId);

        if (error) throw error;
        showInfoModal('Produto excluído com sucesso!');
      } catch (error) {
        console.error("Erro ao excluir produto:", error.message);
        showInfoModal('Erro ao excluir produto.');
      }
    });
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setNewProduct({ name: '', unit: '', quantity: 0, min_stock: 0, category: '' });
  };

  // Agrupar produtos por categoria
  const groupedProducts = products.reduce((acc, product) => {
    const category = product.category || 'Sem Categoria';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {});

  return (
    <div className="container mx-auto p-4 bg-white rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold text-blue-700 mb-6">Gerenciamento de Produtos</h2>

      {isAdmin && (
        <div className="mb-8 p-6 border border-gray-200 rounded-lg bg-gray-50">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">{editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}</h3>
          <form onSubmit={handleSaveProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="name" className="form-label">Nome do Item:</label>
              <input type="text" id="name" name="name" value={newProduct.name} onChange={handleInputChange} className="form-input" required />
            </div>
            <div className="form-group">
              <label htmlFor="unit" className="form-label">Unidade de Medida:</label>
              <input type="text" id="unit" name="unit" value={newProduct.unit} onChange={handleInputChange} className="form-input" required />
            </div>
            <div className="form-group">
              <label htmlFor="quantity" className="form-label">Quantidade em Estoque:</label>
              <input type="number" id="quantity" name="quantity" value={newProduct.quantity} onChange={handleInputChange} className="form-input" min="0" required />
            </div>
            <div className="form-group">
              <label htmlFor="min_stock" className="form-label">Estoque Mínimo:</label>
              <input type="number" id="min_stock" name="min_stock" value={newProduct.min_stock} onChange={handleInputChange} className="form-input" min="0" required />
            </div>
            <div className="form-group">
              <label htmlFor="category" className="form-label">Categoria:</label>
              <input type="text" id="category" name="category" value={newProduct.category} onChange={handleInputChange} className="form-input" required list="categories-list" />
              <datalist id="categories-list">
                {categories.map((cat, index) => (
                  <option key={index} value={cat} />
                ))}
              </datalist>
            </div>
            <div className="md:col-span-2 flex justify-end gap-4 mt-4">
              <button type="submit" className="btn-primary">
                {editingProduct ? 'Atualizar Produto' : 'Adicionar Produto'}
              </button>
              {editingProduct && (
                <button type="button" onClick={handleCancelEdit} className="btn-secondary">
                  Cancelar Edição
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <h3 className="text-2xl font-semibold text-gray-800 mb-4">Lista de Produtos</h3>
      {Object.keys(groupedProducts).length === 0 ? (
        <p className="text-gray-600">Nenhum produto cadastrado ainda.</p>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedProducts).sort(([catA], [catB]) => catA.localeCompare(catB)).map(([category, productsInCategory]) => (
            <div key={category} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <h4 className="text-xl font-bold text-blue-700 mb-4">{category}</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-lg shadow-md">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Nome</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Unidade</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Quantidade</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Estoque Mínimo</th>
                      {isAdmin && (
                        <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Ações</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {productsInCategory.map(product => (
                      <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-800">{product.name}</td>
                        <td className="py-3 px-4 text-gray-800">{product.unit}</td>
                        <td className="py-3 px-4 text-gray-800">{product.quantity}</td>
                        <td className="py-3 px-4 text-gray-800">{product.min_stock}</td>
                        {isAdmin && (
                          <td className="py-3 px-4 flex gap-2">
                            <button onClick={() => handleEditProduct(product)} className="btn-icon text-blue-600 hover:text-blue-800">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-3.646 3.646l-2.828 2.828-1.414-1.414 2.828-2.828 1.414 1.414zm-4.243 2.828l-4.243 4.243V17h4.243L14.243 9.243l-4.243-4.243-4.243 4.243z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDeleteProduct(product.id)} className="btn-icon text-red-600 hover:text-red-800">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Entrada de Produtos no Estoque
function StockEntryPage() {
  const { supabase, currentUser, supabaseUser, showInfoModal } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entries, setEntries] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);

  const isAdmin = supabaseUser?.role === 'admin';
  const canEditDelete = isAdmin; // Apenas admin pode editar/excluir entradas

  useEffect(() => {
    if (!supabase) return;

    const fetchProductsAndEntries = async () => {
      // Fetch products for dropdown
      const { data: productsData, error: productsError } = await supabase.from('products').select('*');
      if (productsError) {
        console.error("Erro ao carregar produtos para entrada:", productsError.message);
        showInfoModal('Erro ao carregar produtos.');
      } else {
        setProducts(productsData);
      }

      // Fetch entries for history
      const { data: entriesData, error: entriesError } = await supabase.from('entries').select('*');
      if (entriesError) {
        console.error("Erro ao carregar entradas:", entriesError.message);
        showInfoModal('Erro ao carregar histórico de entradas.');
      } else {
        // Ordena as entradas pela data mais recente primeiro
        entriesData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setEntries(entriesData);
      }
    };

    fetchProductsAndEntries();

    // Setup real-time subscriptions
    const productsSubscription = supabase
      .channel('products_entry_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        fetchProductsAndEntries();
      })
      .subscribe();

    const entriesSubscription = supabase
      .channel('entries_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, payload => {
        fetchProductsAndEntries();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productsSubscription);
      supabase.removeChannel(entriesSubscription);
    };
  }, [supabase, showInfoModal]);

  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!supabase || !currentUser) {
      showInfoModal('Você precisa estar logado para registrar uma entrada.');
      return;
    }
    if (!selectedProductId || quantity <= 0) {
      showInfoModal('Por favor, selecione um produto e insira uma quantidade válida.');
      return;
    }

    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', selectedProductId)
        .single();

      if (productError) throw productError;
      if (!productData) {
        showInfoModal('Produto não encontrado.');
        return;
      }

      const currentProductQuantity = productData.quantity;
      const newProductQuantity = currentProductQuantity + Number(quantity);

      if (editingEntry) {
        // Lógica de edição de entrada
        const oldQuantity = editingEntry.quantity;
        const diff = Number(quantity) - oldQuantity; // Diferença para ajustar no estoque

        // Atualiza o estoque do produto
        const { error: updateProductError } = await supabase
          .from('products')
          .update({ quantity: currentProductQuantity + diff, updated_at: new Date().toISOString() })
          .eq('id', selectedProductId);
        if (updateProductError) throw updateProductError;

        // Atualiza o registro de entrada
        const { error: updateEntryError } = await supabase
          .from('entries')
          .update({
            product_id: selectedProductId,
            quantity: Number(quantity),
            date: entryDate,
            employee_name: supabaseUser?.email || currentUser.email || currentUser.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingEntry.id);
        if (updateEntryError) throw updateEntryError;

        showInfoModal('Entrada atualizada com sucesso!');
        setEditingEntry(null);
      } else {
        // Atualiza o estoque do produto
        const { error: updateProductError } = await supabase
          .from('products')
          .update({ quantity: newProductQuantity, updated_at: new Date().toISOString() })
          .eq('id', selectedProductId);
        if (updateProductError) throw updateProductError;

        // Adiciona nova entrada
        const { error: insertEntryError } = await supabase
          .from('entries')
          .insert({
            product_id: selectedProductId,
            quantity: Number(quantity),
            date: entryDate,
            employee_name: supabaseUser?.email || currentUser.email || currentUser.id,
          });
        if (insertEntryError) throw insertEntryError;

        showInfoModal('Entrada de estoque registrada com sucesso!');
      }

      setSelectedProductId('');
      setQuantity('');
      setEntryDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error("Erro ao registrar entrada:", error.message);
      showInfoModal('Erro ao registrar entrada. Tente novamente.');
    }
  };

  const handleEditEntry = (entry) => {
    if (!canEditDelete) {
      showInfoModal('Você não tem permissão para editar entradas.');
      return;
    }
    setEditingEntry(entry);
    setSelectedProductId(entry.product_id);
    setQuantity(entry.quantity);
    setEntryDate(entry.date.split('T')[0]); // Formata para 'YYYY-MM-DD'
  };

  const handleDeleteEntry = async (entry) => {
    if (!supabase || !canEditDelete) {
      showInfoModal('Você não tem permissão para excluir entradas.');
      return;
    }
    showInfoModal('Tem certeza que deseja excluir esta entrada? O estoque será ajustado.', async () => {
      try {
        // Reverter a quantidade no estoque do produto
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', entry.product_id)
          .single();

        if (productError) throw productError;
        if (productData) {
          const newQuantity = productData.quantity - entry.quantity;
          const { error: updateProductError } = await supabase
            .from('products')
            .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
            .eq('id', entry.product_id);
          if (updateProductError) throw updateProductError;
        }

        // Excluir o registro de entrada
        const { error: deleteEntryError } = await supabase
          .from('entries')
          .delete()
          .eq('id', entry.id);
        if (deleteEntryError) throw deleteEntryError;

        showInfoModal('Entrada excluída e estoque ajustado com sucesso!');
      } catch (error) {
        console.error("Erro ao excluir entrada:", error.message);
        showInfoModal('Erro ao excluir entrada.');
      }
    });
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setSelectedProductId('');
    setQuantity('');
    setEntryDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="container mx-auto p-4 bg-white rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold text-blue-700 mb-6">Entrada de Produtos no Estoque</h2>

      <div className="mb-8 p-6 border border-gray-200 rounded-lg bg-gray-50">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">{editingEntry ? 'Editar Entrada' : 'Registrar Nova Entrada'}</h3>
        <form onSubmit={handleAddEntry} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label htmlFor="product" className="form-label">Produto:</label>
            <select id="product" name="product" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="form-input" required>
              <option value="">Selecione um produto</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>{product.name} ({product.unit})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="quantity" className="form-label">Quantidade:</label>
            <input type="number" id="quantity" name="quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="form-input" min="1" required />
          </div>
          <div className="form-group">
            <label htmlFor="entryDate" className="form-label">Data da Entrada:</label>
            <input type="date" id="entryDate" name="entryDate" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="form-input" required />
          </div>
          <div className="md:col-span-2 flex justify-end gap-4 mt-4">
            <button type="submit" className="btn-primary">
              {editingEntry ? 'Atualizar Entrada' : 'Registrar Entrada'}
            </button>
            {editingEntry && (
              <button type="button" onClick={handleCancelEdit} className="btn-secondary">
                Cancelar Edição
              </button>
            )}
          </div>
        </form>
      </div>

      <h3 className="text-2xl font-semibold text-gray-800 mb-4">Histórico de Entradas</h3>
      {entries.length === 0 ? (
        <p className="text-gray-600">Nenhuma entrada de estoque registrada ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow-md">
            <thead className="bg-blue-100">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Produto</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Quantidade</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Data</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Funcionário</th>
                {canEditDelete && (
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const product = products.find(p => p.id === entry.product_id);
                return (
                  <tr key={entry.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-800">{product ? product.name : 'Produto Desconhecido'}</td>
                    <td className="py-3 px-4 text-gray-800">{entry.quantity}</td>
                    <td className="py-3 px-4 text-gray-800">{new Date(entry.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-gray-800">{entry.employee_name}</td>
                    {canEditDelete && (
                      <td className="py-3 px-4 flex gap-2">
                        <button onClick={() => handleEditEntry(entry)} className="btn-icon text-blue-600 hover:text-blue-800">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-3.646 3.646l-2.828 2.828-1.414-1.414 2.828-2.828 1.414 1.414zm-4.243 2.828l-4.243 4.243V17h4.243L14.243 9.243l-4.243-4.243-4.243 4.243z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDeleteEntry(entry)} className="btn-icon text-red-600 hover:text-red-800">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Saída de Produtos do Estoque
function StockExitPage() {
  const { supabase, currentUser, supabaseUser, showInfoModal } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
  const [exits, setExits] = useState([]);
  const [editingExit, setEditingExit] = useState(null);

  const isAdmin = supabaseUser?.role === 'admin';
  const canEditDelete = isAdmin; // Apenas admin pode editar/excluir saídas

  useEffect(() => {
    if (!supabase) return;

    const fetchProductsAndExits = async () => {
      // Fetch products for dropdown
      const { data: productsData, error: productsError } = await supabase.from('products').select('*');
      if (productsError) {
        console.error("Erro ao carregar produtos para saída:", productsError.message);
        showInfoModal('Erro ao carregar produtos.');
      } else {
        setProducts(productsData);
      }

      // Fetch exits for history
      const { data: exitsData, error: exitsError } = await supabase.from('exits').select('*');
      if (exitsError) {
        console.error("Erro ao carregar saídas:", exitsError.message);
        showInfoModal('Erro ao carregar histórico de saídas.');
      } else {
        // Ordena as saídas pela data mais recente primeiro
        exitsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setExits(exitsData);
      }
    };

    fetchProductsAndExits();

    // Setup real-time subscriptions
    const productsSubscription = supabase
      .channel('products_exit_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        fetchProductsAndExits();
      })
      .subscribe();

    const exitsSubscription = supabase
      .channel('exits_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exits' }, payload => {
        fetchProductsAndExits();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productsSubscription);
      supabase.removeChannel(exitsSubscription);
    };
  }, [supabase, showInfoModal]);

  const handleAddExit = async (e) => {
    e.preventDefault();
    if (!supabase || !currentUser) {
      showInfoModal('Você precisa estar logado para registrar uma saída.');
      return;
    }
    if (!selectedProductId || quantity <= 0) {
      showInfoModal('Por favor, selecione um produto e insira uma quantidade válida.');
      return;
    }

    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', selectedProductId)
        .single();

      if (productError) throw productError;
      if (!productData) {
        showInfoModal('Produto não encontrado.');
        return;
      }

      const currentProductQuantity = productData.quantity;

      if (editingExit) {
        const oldQuantity = editingExit.quantity;
        const diff = Number(quantity) - oldQuantity; // Diferença para ajustar no estoque

        // Verifica se a nova quantidade não deixará o estoque negativo
        if (currentProductQuantity - diff < 0) {
          showInfoModal('Ajuste de quantidade resultaria em estoque negativo. Operação cancelada.');
          return;
        }

        // Atualiza o estoque do produto
        const { error: updateProductError } = await supabase
          .from('products')
          .update({ quantity: currentProductQuantity - diff, updated_at: new Date().toISOString() })
          .eq('id', selectedProductId);
        if (updateProductError) throw updateProductError;

        // Atualiza o registro de saída
        const { error: updateExitError } = await supabase
          .from('exits')
          .update({
            product_id: selectedProductId,
            quantity: Number(quantity),
            date: exitDate,
            employee_name: supabaseUser?.email || currentUser.email || currentUser.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingExit.id);
        if (updateExitError) throw updateExitError;

        showInfoModal('Saída atualizada com sucesso!');
        setEditingExit(null);
      } else {
        if (currentProductQuantity < Number(quantity)) {
          showInfoModal('Quantidade em estoque insuficiente!');
          return;
        }
        const newProductQuantity = currentProductQuantity - Number(quantity);

        // Atualiza o estoque do produto
        const { error: updateProductError } = await supabase
          .from('products')
          .update({ quantity: newProductQuantity, updated_at: new Date().toISOString() })
          .eq('id', selectedProductId);
        if (updateProductError) throw updateProductError;

        // Adiciona nova saída
        const { error: insertExitError } = await supabase
          .from('exits')
          .insert({
            product_id: selectedProductId,
            quantity: Number(quantity),
            date: exitDate,
            employee_name: supabaseUser?.email || currentUser.email || currentUser.id,
          });
        if (insertExitError) throw insertExitError;

        showInfoModal('Saída de estoque registrada com sucesso!');
      }

      setSelectedProductId('');
      setQuantity('');
      setExitDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error("Erro ao registrar saída:", error.message);
      showInfoModal('Erro ao registrar saída. Tente novamente.');
    }
  };

  const handleEditExit = (exit) => {
    if (!canEditDelete) {
      showInfoModal('Você não tem permissão para editar saídas.');
      return;
    }
    setEditingExit(exit);
    setSelectedProductId(exit.product_id);
    setQuantity(exit.quantity);
    setExitDate(exit.date.split('T')[0]); // Formata para 'YYYY-MM-DD'
  };

  const handleDeleteExit = async (exit) => {
    if (!supabase || !canEditDelete) {
      showInfoModal('Você não tem permissão para excluir saídas.');
      return;
    }
    showInfoModal('Tem certeza que deseja excluir esta saída? O estoque será ajustado.', async () => {
      try {
        // Reverter a quantidade no estoque do produto (adicionar de volta)
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', exit.product_id)
          .single();

        if (productError) throw productError;
        if (productData) {
          const newQuantity = productData.quantity + exit.quantity;
          const { error: updateProductError } = await supabase
            .from('products')
            .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
            .eq('id', exit.product_id);
          if (updateProductError) throw updateProductError;
        }

        // Excluir o registro de saída
        const { error: deleteExitError } = await supabase
          .from('exits')
          .delete()
          .eq('id', exit.id);
        if (deleteExitError) throw deleteExitError;

        showInfoModal('Saída excluída e estoque ajustado com sucesso!');
      } catch (error) {
        console.error("Erro ao excluir saída:", error.message);
        showInfoModal('Erro ao excluir saída.');
      }
    });
  };

  const handleCancelEdit = () => {
    setEditingExit(null);
    setSelectedProductId('');
    setQuantity('');
    setExitDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="container mx-auto p-4 bg-white rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold text-blue-700 mb-6">Saída de Produtos do Estoque</h2>

      <div className="mb-8 p-6 border border-gray-200 rounded-lg bg-gray-50">
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">{editingExit ? 'Editar Saída' : 'Registrar Nova Saída'}</h3>
        <form onSubmit={handleAddExit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label htmlFor="product" className="form-label">Produto:</label>
            <select id="product" name="product" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="form-input" required>
              <option value="">Selecione um produto</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>{product.name} ({product.unit}) - Estoque: {product.quantity}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="quantity" className="form-label">Quantidade Retirada:</label>
            <input type="number" id="quantity" name="quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="form-input" min="1" required />
          </div>
          <div className="form-group">
            <label htmlFor="exitDate" className="form-label">Data da Retirada:</label>
            <input type="date" id="exitDate" name="exitDate" value={exitDate} onChange={(e) => setExitDate(e.target.value)} className="form-input" required />
          </div>
          <div className="md:col-span-2 flex justify-end gap-4 mt-4">
            <button type="submit" className="btn-primary">
              {editingExit ? 'Atualizar Saída' : 'Registrar Saída'}
            </button>
            {editingExit && (
              <button type="button" onClick={handleCancelEdit} className="btn-secondary">
                Cancelar Edição
              </button>
            )}
          </div>
        </form>
      </div>

      <h3 className="text-2xl font-semibold text-gray-800 mb-4">Histórico de Saídas</h3>
      {exits.length === 0 ? (
        <p className="text-gray-600">Nenhuma saída de estoque registrada ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow-md">
            <thead className="bg-blue-100">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Produto</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Quantidade</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Data</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Funcionário</th>
                {canEditDelete && (
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Ações</th>
                )}
              </tr>
            </thead>
            <tbody>
              {exits.map(exit => {
                const product = products.find(p => p.id === exit.product_id);
                return (
                  <tr key={exit.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-800">{product ? product.name : 'Produto Desconhecido'}</td>
                    <td className="py-3 px-4 text-gray-800">{exit.quantity}</td>
                    <td className="py-3 px-4 text-gray-800">{new Date(exit.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-gray-800">{exit.employee_name}</td>
                    {canEditDelete && (
                      <td className="py-3 px-4 flex gap-2">
                        <button onClick={() => handleEditExit(exit)} className="btn-icon text-blue-600 hover:text-blue-800">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-3.646 3.646l-2.828 2.828-1.414-1.414 2.828-2.828 1.414 1.414zm-4.243 2.828l-4.243 4.243V17h4.243L14.243 9.243l-4.243-4.243-4.243 4.243z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDeleteExit(exit)} className="btn-icon text-red-600 hover:text-red-800">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Alertas de Estoque Mínimo
function AlertsPage() {
  const { supabase, showInfoModal } = useContext(AuthContext);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!supabase) return;

    const fetchProducts = async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (error) {
        console.error("Erro ao carregar produtos para alertas:", error.message);
        showInfoModal('Erro ao carregar alertas.');
      } else {
        setProducts(data);
      }
    };

    fetchProducts();

    const subscription = supabase
      .channel('alerts_products_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [supabase, showInfoModal]);

  const lowStockProducts = products.filter(p => p.quantity <= p.min_stock);

  return (
    <div className="container mx-auto p-4 bg-white rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold text-blue-700 mb-6">Alertas de Estoque Mínimo</h2>

      {lowStockProducts.length === 0 ? (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg relative" role="alert">
          <strong className="font-bold">Ótimo!</strong>
          <span className="block sm:inline ml-2">Nenhum item está abaixo do estoque mínimo.</span>
        </div>
      ) : (
        <>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
            <strong className="font-bold">Atenção!</strong>
            <span className="block sm:inline ml-2">Os seguintes itens estão abaixo ou no estoque mínimo. Considere fazer um pedido:</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg shadow-md">
              <thead className="bg-red-100">
                <tr>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Nome do Item</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Unidade</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Quantidade Atual</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Estoque Mínimo</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Categoria</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map(product => (
                  <tr key={product.id} className="border-b border-gray-200 hover:bg-red-50">
                    <td className="py-3 px-4 text-gray-800">{product.name}</td>
                    <td className="py-3 px-4 text-gray-800">{product.unit}</td>
                    <td className="py-3 px-4 font-bold text-red-600">{product.quantity}</td>
                    <td className="py-3 px-4 text-gray-800">{product.min_stock}</td>
                    <td className="py-3 px-4 text-gray-800">{product.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Relatórios por Data
function ReportsPage() {
  const { supabase, showInfoModal } = useContext(AuthContext);
  const [entries, setEntries] = useState([]);
  const [exits, setExits] = useState([]);
  const [products, setProducts] = useState([]);
  const [filterType, setFilterType] = useState('all'); // 'all', 'entry', 'exit'
  const [filterProduct, setFilterProduct] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filteredMovements, setFilteredMovements] = useState([]);

  useEffect(() => {
    if (!supabase) return;

    const fetchAllData = async () => {
      // Fetch products
      const { data: productsData, error: productsError } = await supabase.from('products').select('*');
      if (productsError) {
        console.error("Erro ao carregar produtos para relatórios:", productsError.message);
        showInfoModal('Erro ao carregar produtos.');
      } else {
        setProducts(productsData);
      }

      // Fetch entries
      const { data: entriesData, error: entriesError } = await supabase.from('entries').select('*');
      if (entriesError) {
        console.error("Erro ao carregar entradas para relatórios:", entriesError.message);
        showInfoModal('Erro ao carregar entradas.');
      } else {
        setEntries(entriesData.map(e => ({ ...e, type: 'Entrada' })));
      }

      // Fetch exits
      const { data: exitsData, error: exitsError } = await supabase.from('exits').select('*');
      if (exitsError) {
        console.error("Erro ao carregar saídas para relatórios:", exitsError.message);
        showInfoModal('Erro ao carregar saídas.');
      } else {
        setExits(exitsData.map(e => ({ ...e, type: 'Saída' })));
      }
    };

    fetchAllData();

    // Setup real-time subscriptions for all relevant tables
    const productsSubscription = supabase
      .channel('reports_products_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        fetchAllData();
      })
      .subscribe();

    const entriesSubscription = supabase
      .channel('reports_entries_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, payload => {
        fetchAllData();
      })
      .subscribe();

    const exitsSubscription = supabase
      .channel('reports_exits_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exits' }, payload => {
        fetchAllData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productsSubscription);
      supabase.removeChannel(entriesSubscription);
      supabase.removeChannel(exitsSubscription);
    };
  }, [supabase, showInfoModal]);

  useEffect(() => {
    let allMovements = [];
    if (filterType === 'all' || filterType === 'entry') {
      allMovements = [...allMovements, ...entries];
    }
    if (filterType === 'all' || filterType === 'exit') {
      allMovements = [...allMovements, ...exits];
    }

    const filtered = allMovements.filter(movement => {
      // Filtrar por produto
      if (filterProduct && movement.product_id !== filterProduct) {
        return false;
      }

      // Filtrar por período de data
      if (startDate && movement.date) {
        const moveDate = new Date(movement.date);
        const start = new Date(startDate);
        if (moveDate < start) return false;
      }
      if (endDate && movement.date) {
        const moveDate = new Date(movement.date);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Inclui o dia final
        if (moveDate > end) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Ordena por data decrescente

    setFilteredMovements(filtered);
  }, [entries, exits, filterType, filterProduct, startDate, endDate]);

  return (
    <div className="container mx-auto p-4 bg-white rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold text-blue-700 mb-6">Relatórios de Movimentação</h2>

      <div className="mb-8 p-6 border border-gray-200 rounded-lg bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="form-group">
          <label htmlFor="filterType" className="form-label">Tipo de Movimentação:</label>
          <select id="filterType" value={filterType} onChange={(e) => setFilterType(e.target.value)} className="form-input">
            <option value="all">Todas</option>
            <option value="entry">Entradas</option>
            <option value="exit">Saídas</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="filterProduct" className="form-label">Produto:</label>
          <select id="filterProduct" value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="form-input">
            <option value="">Todos os Produtos</option>
            {products.map(product => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="startDate" className="form-label">Data Inicial:</label>
          <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input" />
        </div>
        <div className="form-group">
          <label htmlFor="endDate" className="form-label">Data Final:</label>
          <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input" />
        </div>
      </div>

      <h3 className="text-2xl font-semibold text-gray-800 mb-4">Histórico Completo</h3>
      {filteredMovements.length === 0 ? (
        <p className="text-gray-600">Nenhuma movimentação encontrada com os filtros selecionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow-md">
            <thead className="bg-blue-100">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Tipo</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Produto</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Quantidade</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Data</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Funcionário</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map(movement => {
                const product = products.find(p => p.id === movement.product_id);
                return (
                  <tr key={movement.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-800">{movement.type}</td>
                    <td className="py-3 px-4 text-gray-800">{product ? product.name : 'Produto Desconhecido'}</td>
                    <td className="py-3 px-4 text-gray-800">{movement.quantity}</td>
                    <td className="py-3 px-4 text-gray-800">{new Date(movement.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-gray-800">{movement.employee_name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Gerenciamento de Usuários (Apenas para Admin)
function UserManagementPage() {
  const { supabase, supabaseUser, showInfoModal } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const isAdmin = supabaseUser?.role === 'admin';

  useEffect(() => {
    if (!supabase || !isAdmin) return;

    const fetchUsers = async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) {
        console.error("Erro ao carregar usuários:", error.message);
        showInfoModal('Erro ao carregar usuários.');
      } else {
        setUsers(data);
      }
    };

    fetchUsers();

    const subscription = supabase
      .channel('profiles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [supabase, isAdmin, showInfoModal]);

  const handleToggleActive = async (userId, currentStatus) => {
    if (!supabase || !isAdmin) {
      showInfoModal('Você não tem permissão para alterar o status de usuários.');
      return;
    }
    if (userId === supabaseUser.id) {
      showInfoModal('Você não pode desativar sua própria conta.');
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      showInfoModal(`Usuário ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (error) {
      console.error("Erro ao alterar status do usuário:", error.message);
      showInfoModal('Erro ao alterar status do usuário.');
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    if (!supabase || !isAdmin) {
      showInfoModal('Você não tem permissão para alterar o papel de usuários.');
      return;
    }
    if (userId === supabaseUser.id) {
      showInfoModal('Você não pode mudar seu próprio papel.');
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      showInfoModal(`Papel do usuário alterado para ${newRole} com sucesso!`);
    } catch (error) {
      console.error("Erro ao alterar papel do usuário:", error.message);
      showInfoModal('Erro ao alterar papel do usuário.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
        <strong className="font-bold">Acesso Negado!</strong>
        <span className="block sm:inline ml-2">Você não tem permissão para acessar esta página.</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 bg-white rounded-lg shadow-xl">
      <h2 className="text-3xl font-bold text-blue-700 mb-6">Gerenciamento de Usuários</h2>

      {users.length === 0 ? (
        <p className="text-gray-600">Nenhum usuário registrado ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow-md">
            <thead className="bg-blue-100">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">ID do Usuário</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Email</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Papel</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-800 text-sm break-all">{user.id}</td>
                  <td className="py-3 px-4 text-gray-800">{user.email || 'N/A'}</td>
                  <td className="py-3 px-4 text-gray-800">
                    <select
                      value={user.role}
                      onChange={(e) => handleChangeRole(user.id, e.target.value)}
                      className="form-input text-sm py-1"
                      disabled={user.id === supabaseUser.id} // Admin não pode mudar o próprio papel
                    >
                      <option value="pending">Pendente</option>
                      <option value="simple">Simples</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-gray-800">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.is_active ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleToggleActive(user.id, user.is_active)}
                      className={`px-3 py-1 rounded-lg text-white text-sm ${user.is_active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                      disabled={user.id === supabaseUser.id} // Admin não pode desativar a própria conta
                    >
                      {user.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Estilos Tailwind CSS globais e componentes reutilizáveis
// Estes estilos são aplicados diretamente nas classes dos elementos JSX.
// Para um projeto React maior, você poderia ter um arquivo CSS separado
// ou usar uma biblioteca de componentes.

/*
.form-group { @apply mb-4; }
.form-label { @apply block text-gray-700 text-sm font-bold mb-2; }
.form-input { @apply shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent; }
.btn-primary { @apply bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md; }
.btn-secondary { @apply bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-300 ease-in-out shadow-md; }
.btn-icon { @apply p-1 rounded-full hover:bg-gray-100 transition-colors; }
.nav-button { @apply px-3 py-2 rounded-lg hover:bg-blue-800 transition-colors duration-200; }
*/

// Adicionar Tailwind CSS CDN no HTML (fora do React App, no arquivo index.html ou similar)
// <script src="https://cdn.tailwindcss.com"></script>
// <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">

export default App;
