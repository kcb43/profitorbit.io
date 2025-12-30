import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";
import Landing from "./Landing";
import Login from "./Login";
import SignUp from "./SignUp";
import ProfileSettings from "./ProfileSettings";

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
import EbayOauthLanding from "./EbayOauthLanding";
import Crosslisting from "./Crosslisting";
import MarketIntelligence from "./MarketIntelligence";
import Settings from "./Settings";
import PrivacyPolicy from "./PrivacyPolicy";
import DevErrorBoundary from "../components/DevErrorBoundary";
import ScrollToTop from "../components/ScrollToTop";
import { AuthGuard } from "../components/AuthGuard";

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
    return (
        <>
            <ScrollToTop />
            <Routes>
              {/* Public Landing Page */}
              <Route path="/" element={<Landing />} />
              
              {/* Login Page */}
              <Route path="/login" element={<Login />} />
              
              {/* Sign Up Page */}
              <Route path="/signup" element={<SignUp />} />
              
              {/* Protected Dashboard Routes */}
              <Route
                path="/dashboard"
                element={
                  <AuthGuard>
                    <Layout currentPageName="Dashboard">
                      <Dashboard />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/Dashboard"
                element={
                  <AuthGuard>
                    <Layout currentPageName="Dashboard">
                      <Dashboard />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              {/* Profile Settings */}
              <Route
                path="/ProfileSettings"
                element={
                  <AuthGuard>
                    <Layout currentPageName="ProfileSettings">
                      <ProfileSettings />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              {/* Other Protected Routes */}
              <Route
                path="/AddSale"
                element={
                  <AuthGuard>
                    <Layout currentPageName="AddSale">
                      <AddSale />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              <Route
                path="/SalesHistory"
                element={
                  <AuthGuard>
                    <Layout currentPageName="SalesHistory">
                      <SalesHistory />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              <Route
                path="/Inventory"
                element={
                  <AuthGuard>
                    <Layout currentPageName="Inventory">
                      {import.meta.env.DEV ? (
                        <DevErrorBoundary>
                          <Inventory />
                        </DevErrorBoundary>
                      ) : (
                        <Inventory />
                      )}
                    </Layout>
                  </AuthGuard>
                }
              />
              
              <Route
                path="/AddInventoryItem"
                element={
                  <AuthGuard>
                    <Layout currentPageName="AddInventoryItem">
                      <AddInventoryItem />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              <Route
                path="/Reports"
                element={
                  <AuthGuard>
                    <Layout currentPageName="Reports">
                      <Reports />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              <Route
                path="/Gallery"
                element={
                  <AuthGuard>
                    <Layout currentPageName="Gallery">
                      <Gallery />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              <Route
                path="/SoldItemDetail"
                element={
                  <AuthGuard>
                    <Layout currentPageName="SoldItemDetail">
                      <SoldItemDetail />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              <Route
                path="/ProfitCalendar"
                element={
                  <AuthGuard>
                    <Layout currentPageName="ProfitCalendar">
                      <ProfitCalendar />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              <Route
                path="/Crosslist"
                element={
                  <AuthGuard>
                    <Layout currentPageName="Crosslist">
                      <Crosslist />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              <Route
                path="/CrosslistComposer"
                element={
                  <AuthGuard>
                    <Layout currentPageName="CrosslistComposer">
                      <CrosslistComposer />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              <Route
                path="/crosslisting"
                element={
                  <AuthGuard>
                    <Layout currentPageName="Crosslisting">
                      <Crosslisting />
                    </Layout>
                  </AuthGuard>
                }
              />
              <Route
                path="/Crosslisting"
                element={
                  <AuthGuard>
                    <Layout currentPageName="Crosslisting">
                      <Crosslisting />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              <Route
                path="/MarketIntelligence"
                element={
                  <AuthGuard>
                    <Layout currentPageName="MarketIntelligence">
                      <MarketIntelligence />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              <Route
                path="/Settings"
                element={
                  <AuthGuard>
                    <Layout currentPageName="Settings">
                      <Settings />
                    </Layout>
                  </AuthGuard>
                }
              />
              
              {/* Public Routes */}
              <Route path="/oauth/ebay" element={<EbayOauthLanding />} />
              <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
            </Routes>
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