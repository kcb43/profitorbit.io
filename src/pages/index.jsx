import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import AddSale from "./AddSale";

import SalesHistory from "./SalesHistory";

import Inventory from "./Inventory";

import AddInventoryItem from "./AddInventoryItem";

import Reports from "./Reports";

import Gallery from "./Gallery";

import SoldItemDetail from "./SoldItemDetail";

import ProfitCalendar from "./ProfitCalendar";

import Crosslist from "./Crosslist";
import CrosslistComposer from "./CrosslistComposer";
import Crosslisting from "./Crosslisting";
import MarketIntelligence from "./MarketIntelligence";
import Settings from "./Settings";
import PrivacyPolicy from "./PrivacyPolicy";
import DevErrorBoundary from "../components/DevErrorBoundary";
import ScrollToTop from "../components/ScrollToTop";

import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    AddSale: AddSale,
    
    SalesHistory: SalesHistory,
    
    Inventory: Inventory,
    
    AddInventoryItem: AddInventoryItem,
    
    Reports: Reports,
    
    Gallery: Gallery,
    
    SoldItemDetail: SoldItemDetail,
    
    ProfitCalendar: ProfitCalendar,
    
    Crosslist: Crosslist,
    
    CrosslistComposer: CrosslistComposer,
    
    Crosslisting: Crosslisting,
    
    MarketIntelligence: MarketIntelligence,
    
    Settings: Settings,
    
    
    PrivacyPolicy: PrivacyPolicy,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <>
            <ScrollToTop />
            <Layout currentPageName={currentPage}>
                <Routes>            
                
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                
                
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/AddSale" element={<AddSale />} />
                
                <Route path="/SalesHistory" element={<SalesHistory />} />
                
                <Route
                  path="/Inventory"
                  element={
                    import.meta.env.DEV ? (
                      <DevErrorBoundary>
                        <Inventory />
                      </DevErrorBoundary>
                    ) : (
                      <Inventory />
                    )
                  }
                />
                
                <Route path="/AddInventoryItem" element={<AddInventoryItem />} />
                
                <Route path="/Reports" element={<Reports />} />
                
                <Route path="/Gallery" element={<Gallery />} />
                
                <Route path="/SoldItemDetail" element={<SoldItemDetail />} />
                
                <Route path="/ProfitCalendar" element={<ProfitCalendar />} />
                
                <Route path="/Crosslist" element={<Crosslist />} />
                
                <Route path="/CrosslistComposer" element={<CrosslistComposer />} />
                
                <Route path="/crosslisting" element={<Crosslisting />} />
                <Route path="/Crosslisting" element={<Crosslisting />} />
                
                <Route path="/MarketIntelligence" element={<MarketIntelligence />} />
                
                <Route path="/Settings" element={<Settings />} />
                
                
                <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
                
                </Routes>
            </Layout>
        </>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}