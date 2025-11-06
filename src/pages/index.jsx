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

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

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
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/AddSale" element={<AddSale />} />
                
                <Route path="/SalesHistory" element={<SalesHistory />} />
                
                <Route path="/Inventory" element={<Inventory />} />
                
                <Route path="/AddInventoryItem" element={<AddInventoryItem />} />
                
                <Route path="/Reports" element={<Reports />} />
                
                <Route path="/Gallery" element={<Gallery />} />
                
                <Route path="/SoldItemDetail" element={<SoldItemDetail />} />
                
                <Route path="/ProfitCalendar" element={<ProfitCalendar />} />
                
                <Route path="/Crosslist" element={<Crosslist />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}