import React, { useMemo, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { useNavigate, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RichTextarea } from "@/components/ui/rich-textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Rocket,
  ImagePlus,
  ImageIcon,
  X,
  RefreshCw,
  Save,
  Package,
  Palette,
  ArrowLeft,
  GripVertical,
  Sparkles,
  BarChart,
  ExternalLink,
  Lock,
  Unlock,
  Settings,
  Eye,
  DollarSign,
  Truck,
  Tag,
  Home,
} from "lucide-react";
import ColorPickerDialog from "../components/ColorPickerDialog";
import SoldLookupDialog from "../components/SoldLookupDialog";
import EbaySearchDialog from "../components/EbaySearchDialog";
import imageCompression from "browser-image-compression";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInventoryTags } from "@/hooks/useInventoryTags";
import { useEbayCategoryTreeId, useEbayCategories, useEbayCategoryAspects } from "@/hooks/useEbayCategorySuggestions";
import { TagInput } from "@/components/TagInput";
import { DescriptionGenerator } from "@/components/DescriptionGenerator";
import { getEbayItemUrl } from "@/utils/ebayHelpers";
import { ImageEditor } from "@/components/ImageEditor";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { createMarketplaceListing, getUserPages, isConnected } from "@/api/facebookClient";

const FACEBOOK_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg";
const MERCARI_ICON_URL = "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B";
const EBAY_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg";
const ETSY_ICON_URL = "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B";
const POSHMARK_ICON_URL = "https://cdn.brandfetch.io/idUxsADOAW/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B";

// Predefined categories that should be cleared when loading items into crosslisting composer
// to allow users to select from eBay category picklist instead
const PREDEFINED_CATEGORIES = [
  "Antiques",
  "Books, Movies & Music",
  "Clothing & Apparel",
  "Collectibles",
  "Electronics",
  "Gym/Workout",
  "Health & Beauty",
  "Home & Garden",
  "Jewelry & Watches",
  "Kitchen",
  "Makeup",
  "Mic/Audio Equipment",
  "Motorcycle",
  "Motorcycle Accessories",
  "Pets",
  "Pool Equipment",
  "Shoes/Sneakers",
  "Sporting Goods",
  "Stereos & Speakers",
  "Tools",
  "Toys & Hobbies",
  "Yoga"
];

// Mercari Category Tree
const MERCARI_CATEGORIES = {
  "1": {
    id: "1",
    name: "Women",
    subcategories: {
      "11": {
        id: "11",
        name: "Dresses",
        subcategories: {
          "149": { id: "149", name: "Above knee, mini" },
          "150": { id: "150", name: "Knee-length" },
          "151": { id: "151", name: "Midi" },
          "152": { id: "152", name: "Maxi" },
          "153": { id: "153", name: "High Low" },
          "154": { id: "154", name: "Other" },
          "1866": { id: "1866", name: "Jumpsuits & Rompers" }
        }
      },
      "12": {
        id: "12",
        name: "Tops & blouses",
        subcategories: {
          "155": { id: "155", name: "Blouse" },
          "156": { id: "156", name: "Button down shirt" },
          "157": { id: "157", name: "Halter" },
          "158": { id: "158", name: "Knit top" },
          "159": { id: "159", name: "Polo shirt" },
          "161": { id: "161", name: "T-shirts" },
          "162": { id: "162", name: "Tunic" },
          "163": { id: "163", name: "Turtleneck" },
          "164": { id: "164", name: "Wrap" },
          "165": { id: "165", name: "Other" },
          "1955": { id: "1955", name: "Bodysuits" },
          "1956": { id: "1956", name: "Camisoles" },
          "1957": { id: "1957", name: "Tank Tops" }
        }
      },
      "13": {
        id: "13",
        name: "Sweaters",
        subcategories: {
          "166": { id: "166", name: "Cardigan" },
          "167": { id: "167", name: "Collared" },
          "168": { id: "168", name: "Cowl neck" },
          "169": { id: "169", name: "Crewneck" },
          "170": { id: "170", name: "Full zip" },
          "171": { id: "171", name: "Henley" },
          "172": { id: "172", name: "Hooded" },
          "173": { id: "173", name: "Poncho" },
          "174": { id: "174", name: "Scoop neck" },
          "175": { id: "175", name: "Shrug" },
          "176": { id: "176", name: "Sweatercoat" },
          "177": { id: "177", name: "Tunic" },
          "180": { id: "180", name: "V-neck" },
          "181": { id: "181", name: "Wrap" },
          "182": { id: "182", name: "Other" },
          "1958": { id: "1958", name: "Mock Sweaters" },
          "1959": { id: "1959", name: "Turtleneck Sweaters" },
          "1960": { id: "1960", name: "Sleeveless Sweaters" },
          "1961": { id: "1961", name: "Sweater Vests" }
        }
      },
      "14": {
        id: "14",
        name: "Jeans",
        subcategories: {
          "183": { id: "183", name: "Boot cut" },
          "184": { id: "184", name: "Boyfriend" },
          "186": { id: "186", name: "Cargo" },
          "187": { id: "187", name: "Flare" },
          "188": { id: "188", name: "Leggings" },
          "189": { id: "189", name: "Overalls" },
          "190": { id: "190", name: "Relaxed" },
          "192": { id: "192", name: "Straight leg" },
          "193": { id: "193", name: "Wide leg" },
          "194": { id: "194", name: "Other" },
          "1962": { id: "1962", name: "Capri Jeans" },
          "1963": { id: "1963", name: "Cropped Jeans" },
          "1964": { id: "1964", name: "Skinny Jeans" },
          "1965": { id: "1965", name: "Slim Jeans" }
        }
      },
      "15": {
        id: "15",
        name: "Pants",
        subcategories: {
          "196": { id: "196", name: "Cargo" },
          "197": { id: "197", name: "Casual pants" },
          "198": { id: "198", name: "Corduroys" },
          "199": { id: "199", name: "Dress pants" },
          "200": { id: "200", name: "Khakis, chinos" },
          "201": { id: "201", name: "Leather" },
          "202": { id: "202", name: "Linen" },
          "203": { id: "203", name: "Other" },
          "1966": { id: "1966", name: "Capri Pants" },
          "1967": { id: "1967", name: "Cropped Pants" }
        }
      },
      "16": {
        id: "16",
        name: "Skirts",
        subcategories: {
          "204": { id: "204", name: "A-line" },
          "205": { id: "205", name: "Asymmetrical" },
          "206": { id: "206", name: "Bubble" },
          "207": { id: "207", name: "Full skirt" },
          "208": { id: "208", name: "Maxi" },
          "209": { id: "209", name: "Mini" },
          "210": { id: "210", name: "Peasant" },
          "211": { id: "211", name: "Pleated" },
          "212": { id: "212", name: "Straight, pencil" },
          "213": { id: "213", name: "Tiered" },
          "214": { id: "214", name: "Wrap" },
          "215": { id: "215", name: "Other" }
        }
      },
      "17": {
        id: "17",
        name: "Coats & jackets",
        subcategories: {
          "216": { id: "216", name: "Cape" },
          "217": { id: "217", name: "Fleece jacket" },
          "218": { id: "218", name: "Jean jacket" },
          "219": { id: "219", name: "Military" },
          "220": { id: "220", name: "Motorcycle" },
          "221": { id: "221", name: "Parka" },
          "222": { id: "222", name: "Peacoat" },
          "223": { id: "223", name: "Poncho" },
          "224": { id: "224", name: "Puffer" },
          "225": { id: "225", name: "Raincoat" },
          "226": { id: "226", name: "Trench" },
          "227": { id: "227", name: "Vest" },
          "228": { id: "228", name: "Windbreaker" },
          "229": { id: "229", name: "Wool" },
          "230": { id: "230", name: "Other" }
        }
      },
      "18": {
        id: "18",
        name: "Suits & blazers",
        subcategories: {
          "231": { id: "231", name: "Blazer" },
          "232": { id: "232", name: "Dress suit" },
          "233": { id: "233", name: "Pant suit" },
          "234": { id: "234", name: "Skirt suit" },
          "235": { id: "235", name: "Other" }
        }
      },
      "19": {
        id: "19",
        name: "Athletic apparel",
        subcategories: {
          "236": { id: "236", name: "Jackets" },
          "237": { id: "237", name: "Jerseys" },
          "240": { id: "240", name: "Shorts" },
          "243": { id: "243", name: "Socks" },
          "244": { id: "244", name: "Sports bras" },
          "246": { id: "246", name: "Vests" },
          "247": { id: "247", name: "Other" },
          "1968": { id: "1968", name: "Athletic Leggings" },
          "1969": { id: "1969", name: "Athletic Pants" },
          "1970": { id: "1970", name: "Athletic Tights" },
          "1971": { id: "1971", name: "Athletic Polos" },
          "1972": { id: "1972", name: "Athletic T-Shirts" },
          "1973": { id: "1973", name: "Athletic Tank Tops" },
          "1974": { id: "1974", name: "Athletic Dresses" },
          "1975": { id: "1975", name: "Athletic Skirts" },
          "1976": { id: "1976", name: "Athletic Skorts" },
          "1977": { id: "1977", name: "Snow Bibs" },
          "1978": { id: "1978", name: "Snow Pants" },
          "1979": { id: "1979", name: "Snowsuits" },
          "1980": { id: "1980", name: "Athletic Hoodies" },
          "1981": { id: "1981", name: "Athletic Sweat Pants" },
          "1982": { id: "1982", name: "Athletic Sweatshirts" },
          "1983": { id: "1983", name: "Athletic Sweatsuits" },
          "1984": { id: "1984", name: "Track Jackets" },
          "1985": { id: "1985", name: "Track Pants" },
          "1986": { id: "1986", name: "Tracksuits" }
        }
      },
      "20": {
        id: "20",
        name: "Swimwear",
        subcategories: {
          "248": { id: "248", name: "One-piece" },
          "249": { id: "249", name: "Two-piece" },
          "250": { id: "250", name: "Cover-ups" },
          "251": { id: "251", name: "Beach accessories" }
        }
      },
      "21": {
        id: "21",
        name: "Women's handbags",
        subcategories: {
          "252": { id: "252", name: "Shoulder Bags" },
          "253": { id: "253", name: "Tote Bags" },
          "254": { id: "254", name: "Crossbody Bags" },
          "255": { id: "255", name: "Satchel" },
          "256": { id: "256", name: "Hobo Bags" },
          "258": { id: "258", name: "Backpacks" },
          "259": { id: "259", name: "Cosmetic bags" },
          "260": { id: "260", name: "Other" },
          "1863": { id: "1863", name: "Waist Bags & Fanny Packs" },
          "1864": { id: "1864", name: "Messenger Bags" },
          "1865": { id: "1865", name: "Bucket Bags" }
        }
      },
      "22": {
        id: "22",
        name: "Women's accessories",
        subcategories: {
          "261": { id: "261", name: "Sunglasses" },
          "262": { id: "262", name: "Wallets" },
          "264": { id: "264", name: "Belts" },
          "265": { id: "265", name: "Hats" },
          "266": { id: "266", name: "Hair accessories" },
          "267": { id: "267", name: "Watches" },
          "268": { id: "268", name: "Other" },
          "1987": { id: "1987", name: "Scarves" },
          "1988": { id: "1988", name: "Wraps" },
          "2624": { id: "2624", name: "Bandanas" },
          "2625": { id: "2625", name: "Fascinators" },
          "2626": { id: "2626", name: "Fashion Gloves" },
          "2627": { id: "2627", name: "Headbands" },
          "2628": { id: "2628", name: "Hijabs" },
          "2629": { id: "2629", name: "Umbrellas" },
          "3169": { id: "3169", name: "Cardholders" }
        }
      },
      "23": {
        id: "23",
        name: "Jewelry",
        subcategories: {
          "269": { id: "269", name: "Rings" },
          "270": { id: "270", name: "Necklaces" },
          "271": { id: "271", name: "Earrings" },
          "272": { id: "272", name: "Bracelets" },
          "2622": { id: "2622", name: "Nose Rings" },
          "2623": { id: "2623", name: "Toe Rings" },
          "3168": { id: "3168", name: "Pins" }
        }
      },
      "24": {
        id: "24",
        name: "Maternity",
        subcategories: {
          "273": { id: "273", name: "Dresses" },
          "275": { id: "275", name: "Sweaters" },
          "276": { id: "276", name: "Jeans" },
          "277": { id: "277", name: "Pants" },
          "278": { id: "278", name: "Skirts" },
          "279": { id: "279", name: "Coats & jackets" },
          "281": { id: "281", name: "Athletic apparel" },
          "282": { id: "282", name: "Other" },
          "1989": { id: "1989", name: "Maternity Blouses" },
          "1990": { id: "1990", name: "Maternity Button-Ups" },
          "1991": { id: "1991", name: "Maternity Camisoles" },
          "1992": { id: "1992", name: "Maternity Polos" },
          "1993": { id: "1993", name: "Maternity T-Shirts" },
          "1994": { id: "1994", name: "Maternity Tank Tops" },
          "1995": { id: "1995", name: "Maternity Blazers" },
          "1996": { id: "1996", name: "Maternity Suit Jackets" },
          "1997": { id: "1997", name: "Maternity Suit Pants" },
          "1998": { id: "1998", name: "Maternity Suits" },
          "1999": { id: "1999", name: "Maternity Suit Skirts" },
          "2000": { id: "2000", name: "Maternity Suit Vests" }
        }
      },
      "25": {
        id: "25",
        name: "Shoes",
        subcategories: {
          "283": { id: "283", name: "Athletic" },
          "284": { id: "284", name: "Boots" },
          "285": { id: "285", name: "Fashion sneakers" },
          "286": { id: "286", name: "Flats" },
          "289": { id: "289", name: "Outdoor" },
          "290": { id: "290", name: "Oxfords" },
          "291": { id: "291", name: "Heels" },
          "292": { id: "292", name: "Sandals" },
          "293": { id: "293", name: "Slippers" },
          "294": { id: "294", name: "Work & safety" },
          "295": { id: "295", name: "Other" },
          "2001": { id: "2001", name: "Loafers" },
          "2002": { id: "2002", name: "Slip-Ons" },
          "2003": { id: "2003", name: "Clogs" },
          "2004": { id: "2004", name: "Mules" }
        }
      },
      "26": { id: "26", name: "Other" },
      "1561": {
        id: "1561",
        name: "Underwear",
        subcategories: {
          "1562": { id: "1562", name: "G-strings & thongs" },
          "1563": { id: "1563", name: "Panties" },
          "1564": { id: "1564", name: "Thermal underwear" },
          "1565": { id: "1565", name: "Bras" },
          "1566": { id: "1566", name: "Other" }
        }
      },
      "1936": {
        id: "1936",
        name: "Shorts",
        subcategories: {
          "1937": { id: "1937", name: "Bermuda" },
          "1938": { id: "1938", name: "Bike" },
          "1939": { id: "1939", name: "Cargo" },
          "1940": { id: "1940", name: "Chino & khaki" },
          "1941": { id: "1941", name: "Denim" },
          "1942": { id: "1942", name: "High-waisted" },
          "1943": { id: "1943", name: "Pull-on" },
          "1944": { id: "1944", name: "Short shorts" },
          "1945": { id: "1945", name: "Skort" },
          "1946": { id: "1946", name: "Other" }
        }
      },
      "1947": {
        id: "1947",
        name: "Sleepwear & robes",
        subcategories: {
          "1948": { id: "1948", name: "Nightgowns & sleep shirts" },
          "1949": { id: "1949", name: "Pajama pants" },
          "1950": { id: "1950", name: "Pajama sets" },
          "1951": { id: "1951", name: "Pajama shorts" },
          "1952": { id: "1952", name: "Pajama tops" },
          "1953": { id: "1953", name: "Robes" },
          "1954": { id: "1954", name: "Other" }
        }
      }
    }
  },
  "2": {
    id: "2",
    name: "Men",
    subcategories: {
      "27": {
        id: "27",
        name: "Tops",
        subcategories: {
          "297": { id: "297", name: "Button-front" },
          "298": { id: "298", name: "Dress shirts" },
          "299": { id: "299", name: "Hawaiian" },
          "300": { id: "300", name: "Henley" },
          "302": { id: "302", name: "Tank" },
          "303": { id: "303", name: "T-shirts" },
          "304": { id: "304", name: "Turtleneck" },
          "305": { id: "305", name: "Other" },
          "2005": { id: "2005", name: "Polos" },
          "2006": { id: "2006", name: "Rugby Shirts" }
        }
      },
      "28": {
        id: "28",
        name: "Sweats & hoodies",
        subcategories: {
          "306": { id: "306", name: "Hoodie" },
          "307": { id: "307", name: "Sweatshirt, pullover" },
          "308": { id: "308", name: "Sweat Pants" },
          "309": { id: "309", name: "Sweatsuits" },
          "310": { id: "310", name: "Track jacket" },
          "311": { id: "311", name: "Other" }
        }
      },
      "29": {
        id: "29",
        name: "Sweaters",
        subcategories: {
          "312": { id: "312", name: "Cardigan" },
          "313": { id: "313", name: "Crewneck" },
          "314": { id: "314", name: "Full zip" },
          "315": { id: "315", name: "Polo" },
          "316": { id: "316", name: "Turtleneck" },
          "317": { id: "317", name: "Vest" },
          "318": { id: "318", name: "V-neck" },
          "319": { id: "319", name: "Other" }
        }
      },
      "30": {
        id: "30",
        name: "Jeans",
        subcategories: {
          "320": { id: "320", name: "Baggy, loose" },
          "321": { id: "321", name: "Boot cut" },
          "322": { id: "322", name: "Cargo" },
          "323": { id: "323", name: "Carpenter" },
          "324": { id: "324", name: "Classic, straight leg" },
          "325": { id: "325", name: "Overalls" },
          "326": { id: "326", name: "Relaxed" },
          "328": { id: "328", name: "Other" },
          "2007": { id: "2007", name: "Skinny Jeans" },
          "2008": { id: "2008", name: "Slim Jeans" }
        }
      },
      "31": {
        id: "31",
        name: "Pants",
        subcategories: {
          "329": { id: "329", name: "Cargo" },
          "330": { id: "330", name: "Carpenter" },
          "331": { id: "331", name: "Casual pants" },
          "332": { id: "332", name: "Corduroys" },
          "333": { id: "333", name: "Dress - flat front" },
          "334": { id: "334", name: "Dress - pleat" },
          "335": { id: "335", name: "Khakis, chinos" },
          "336": { id: "336", name: "Other" }
        }
      },
      "32": {
        id: "32",
        name: "Shorts",
        subcategories: {
          "337": { id: "337", name: "Athletic" },
          "338": { id: "338", name: "Board, surf" },
          "339": { id: "339", name: "Cargo" },
          "340": { id: "340", name: "Carpenter, utility" },
          "341": { id: "341", name: "Casual shorts" },
          "342": { id: "342", name: "Corduroys" },
          "343": { id: "343", name: "Denim" },
          "344": { id: "344", name: "Dress shorts" },
          "345": { id: "345", name: "Khakis, chinos" },
          "346": { id: "346", name: "Other" }
        }
      },
      "33": {
        id: "33",
        name: "Coats & jackets",
        subcategories: {
          "347": { id: "347", name: "Fleece jacket" },
          "348": { id: "348", name: "Flight/bomber" },
          "349": { id: "349", name: "Jean jacket" },
          "350": { id: "350", name: "Military" },
          "351": { id: "351", name: "Motorcycle" },
          "352": { id: "352", name: "Parka" },
          "353": { id: "353", name: "Peacoat" },
          "354": { id: "354", name: "Poncho" },
          "355": { id: "355", name: "Puffer" },
          "356": { id: "356", name: "Rainwear" },
          "357": { id: "357", name: "Trench" },
          "358": { id: "358", name: "Varsity/baseball" },
          "359": { id: "359", name: "Vest" },
          "360": { id: "360", name: "Windbreaker" },
          "361": { id: "361", name: "Wool" },
          "362": { id: "362", name: "Other" }
        }
      },
      "34": {
        id: "34",
        name: "Blazers & sport coats",
        subcategories: {
          "363": { id: "363", name: "Double breasted" },
          "364": { id: "364", name: "Four button" },
          "365": { id: "365", name: "One button" },
          "366": { id: "366", name: "Three button" },
          "367": { id: "367", name: "Two button" },
          "368": { id: "368", name: "Other" }
        }
      },
      "35": {
        id: "35",
        name: "Suits",
        subcategories: {
          "369": { id: "369", name: "One button" },
          "370": { id: "370", name: "Two button" },
          "371": { id: "371", name: "Three button" },
          "372": { id: "372", name: "Four button" },
          "373": { id: "373", name: "Double breasted" },
          "374": { id: "374", name: "Tuxedo" },
          "375": { id: "375", name: "Other" }
        }
      },
      "36": {
        id: "36",
        name: "Athletic apparel",
        subcategories: {
          "376": { id: "376", name: "Competitive swimwear" },
          "377": { id: "377", name: "Jackets" },
          "378": { id: "378", name: "Jerseys" },
          "379": { id: "379", name: "Pants" },
          "381": { id: "381", name: "Shorts" },
          "383": { id: "383", name: "Socks" },
          "385": { id: "385", name: "Vests" },
          "386": { id: "386", name: "Other" },
          "2009": { id: "2009", name: "Athletic Polos" },
          "2010": { id: "2010", name: "Athletic Long Sleeve Shirts" },
          "2011": { id: "2011", name: "Athletic Short Sleeve Shirts" },
          "2012": { id: "2012", name: "Jerseys" },
          "2013": { id: "2013", name: "Athletic T-Shirts" },
          "2014": { id: "2014", name: "Athletic Tank Tops" },
          "2015": { id: "2015", name: "Snow Bibs" },
          "2016": { id: "2016", name: "Snow Pants" },
          "2017": { id: "2017", name: "Snowsuits" },
          "2018": { id: "2018", name: "Athletic Hoodies" },
          "2019": { id: "2019", name: "Athletic Sweat Pants" },
          "2020": { id: "2020", name: "Athletic Sweatshirts" },
          "2022": { id: "2022", name: "Track Pants" },
          "2023": { id: "2023", name: "Tracksuits" }
        }
      },
      "37": {
        id: "37",
        name: "Swimwear",
        subcategories: {
          "387": { id: "387", name: "Board shorts" },
          "388": { id: "388", name: "Swim briefs" },
          "389": { id: "389", name: "Swim trunks" }
        }
      },
      "38": {
        id: "38",
        name: "Men's accessories",
        subcategories: {
          "391": { id: "391", name: "Belts" },
          "392": { id: "392", name: "Hats" },
          "393": { id: "393", name: "Sunglasses" },
          "394": { id: "394", name: "Ties" },
          "395": { id: "395", name: "Watches" },
          "396": { id: "396", name: "Other" },
          "1560": { id: "1560", name: "Wallets" },
          "2024": { id: "2024", name: "Backpacks" },
          "2025": { id: "2025", name: "Bags" },
          "2026": { id: "2026", name: "Briefcases" },
          "2519": { id: "2519", name: "Bandanas" },
          "2520": { id: "2520", name: "Bow Ties" },
          "2521": { id: "2521", name: "Collar Stays" },
          "2522": { id: "2522", name: "Fashion Gloves" },
          "2523": { id: "2523", name: "Handkerchiefs" },
          "2524": { id: "2524", name: "Scarves" },
          "2525": { id: "2525", name: "Turbans" },
          "2526": { id: "2526", name: "Umbrellas" },
          "2881": { id: "2881", name: "Cardholders" }
        }
      },
      "39": {
        id: "39",
        name: "Shoes",
        subcategories: {
          "397": { id: "397", name: "Athletic" },
          "398": { id: "398", name: "Boots" },
          "399": { id: "399", name: "Fashion sneakers" },
          "402": { id: "402", name: "Outdoor" },
          "403": { id: "403", name: "Oxfords" },
          "404": { id: "404", name: "Sandals" },
          "405": { id: "405", name: "Slippers" },
          "406": { id: "406", name: "Work & safety" },
          "2027": { id: "2027", name: "Loafers" },
          "2028": { id: "2028", name: "Slip-Ons" },
          "2029": { id: "2029", name: "Clogs" },
          "2030": { id: "2030", name: "Mules" }
        }
      },
      "40": { id: "40", name: "Other" },
      "2874": {
        id: "2874",
        name: "Jewelry",
        subcategories: {
          "2875": { id: "2875", name: "Bracelets" },
          "2876": { id: "2876", name: "Cufflinks" },
          "2877": { id: "2877", name: "Earrings" },
          "2878": { id: "2878", name: "Necklaces" },
          "2879": { id: "2879", name: "Pins" },
          "2880": { id: "2880", name: "Rings" }
        }
      }
    }
  },
  "7": {
    id: "7",
    name: "Electronics",
    subcategories: {
      "80": {
        id: "80",
        name: "Cameras & photography",
        subcategories: {
          "759": { id: "759", name: "Digital cameras" },
          "760": { id: "760", name: "Camcorders" },
          "761": { id: "761", name: "Camera & photo accessories" },
          "766": { id: "766", name: "Lighting & studio" },
          "767": { id: "767", name: "Film & Polaroid Cameras" },
          "768": { id: "768", name: "Other" },
          "2134": { id: "2134", name: "Camera Filters" },
          "2135": { id: "2135", name: "Camera Lenses" },
          "2136": { id: "2136", name: "Photography Supports" },
          "2137": { id: "2137", name: "Photography Tripods" },
          "2138": { id: "2138", name: "Camera Flash Accessories" },
          "2139": { id: "2139", name: "Camera Flashes" },
          "2140": { id: "2140", name: "Binoculars" },
          "2141": { id: "2141", name: "Telescopes" },
          "2205": { id: "2205", name: "Sport Cameras" },
          "2206": { id: "2206", name: "Waterproof Cameras" },
          "2207": { id: "2207", name: "Camera Films" },
          "2208": { id: "2208", name: "Polaroid Films" }
        }
      },
      "81": {
        id: "81",
        name: "Computers & Laptops",
        subcategories: {
          "774": { id: "774", name: "Networking & connectivity" },
          "777": { id: "777", name: "Other" },
          "1595": { id: "1595", name: "Monitors & Screens" },
          "1596": { id: "1596", name: "Computer Accessories" },
          "2145": { id: "2145", name: "Laptops" },
          "2146": { id: "2146", name: "Netbooks" },
          "2147": { id: "2147", name: "Desktops Computers" },
          "2148": { id: "2148", name: "All-In-One Computers" },
          "2149": { id: "2149", name: "Printers" },
          "2150": { id: "2150", name: "Printing Supplies" },
          "2151": { id: "2151", name: "Scanners" },
          "2152": { id: "2152", name: "Computer Drives" },
          "2153": { id: "2153", name: "Computer Media" },
          "2154": { id: "2154", name: "Computer Storage" },
          "2268": { id: "2268", name: "All-In-One Printers" }
        }
      },
      "82": {
        id: "82",
        name: "Cell phones & accessories",
        subcategories: {
          "778": { id: "778", name: "Cell phones & smartphones" },
          "779": { id: "779", name: "Cell phone accessories" },
          "780": { id: "780", name: "Headsets" },
          "782": { id: "782", name: "Screen protectors" },
          "784": { id: "784", name: "Batteries" },
          "786": { id: "786", name: "Other" },
          "2155": { id: "2155", name: "Cell Phone Cases" },
          "2156": { id: "2156", name: "Cell Phone Covers" },
          "2157": { id: "2157", name: "Cell Phone Skins" },
          "2158": { id: "2158", name: "Cell Phone Chargers" },
          "2159": { id: "2159", name: "Cell Phone Cradles" },
          "2160": { id: "2160", name: "Cell Phone Adapters" },
          "2161": { id: "2161", name: "Cell Phone Cables" },
          "2631": { id: "2631", name: "Wireless Cell Phone Chargers" }
        }
      },
      "83": {
        id: "83",
        name: "TV & Video",
        subcategories: {
          "787": { id: "787", name: "Televisions" },
          "794": { id: "794", name: "Gadgets" },
          "795": { id: "795", name: "Other" },
          "1578": { id: "1578", name: "Streaming Devices" },
          "2164": { id: "2164", name: "Blu-ray Players" },
          "2165": { id: "2165", name: "DVD Players" },
          "2201": { id: "2201", name: "Projector Screens" },
          "2202": { id: "2202", name: "Projectors" },
          "2632": { id: "2632", name: "DVRs" }
        }
      },
      "84": {
        id: "84",
        name: "Video games & consoles",
        subcategories: {
          "796": { id: "796", name: "Games" },
          "797": { id: "797", name: "Consoles" },
          "798": { id: "798", name: "Accessories" },
          "800": { id: "800", name: "Strategy guides" },
          "802": { id: "802", name: "Replacement parts & tools" },
          "803": { id: "803", name: "Other" },
          "1599": { id: "1599", name: "PC Gaming" }
        }
      },
      "85": {
        id: "85",
        name: "Car audio, video & gps",
        subcategories: {
          "805": { id: "805", name: "GPS units & equipment" },
          "806": { id: "806", name: "Car speakers & systems" },
          "807": { id: "807", name: "Car subwoofers" },
          "808": { id: "808", name: "Car video" },
          "809": { id: "809", name: "Car security & convenience" },
          "810": { id: "810", name: "Car A/V installation" },
          "813": { id: "813", name: "Other" },
          "2166": { id: "2166", name: "Car Amplifiers" },
          "2167": { id: "2167", name: "Car CD Changers" },
          "2168": { id: "2168", name: "Car Equalizers" },
          "2169": { id: "2169", name: "Car Stereo Receivers" },
          "2170": { id: "2170", name: "GPS Accessories" },
          "2171": { id: "2171", name: "GPS Car Mounts" },
          "2246": { id: "2246", name: "Car Coaxial Speakers" },
          "2247": { id: "2247", name: "Car Component Speakers" },
          "2248": { id: "2248", name: "Car Mid-Range Speakers" },
          "2249": { id: "2249", name: "Car Tweeters" },
          "2250": { id: "2250", name: "Car Woofers" }
        }
      },
      "86": {
        id: "86",
        name: "Media",
        subcategories: {
          "814": { id: "814", name: "Blu-ray" },
          "815": { id: "815", name: "DVD" },
          "816": { id: "816", name: "CD" },
          "817": { id: "817", name: "VHS" },
          "818": { id: "818", name: "Other" }
        }
      },
      "87": { id: "87", name: "Other" },
      "775": {
        id: "775",
        name: "Computer Components & Parts",
        subcategories: {
          "2251": { id: "2251", name: "Computer Case Fans" },
          "2252": { id: "2252", name: "Computer Controller Cards" },
          "2253": { id: "2253", name: "Computer CPUs" },
          "2254": { id: "2254", name: "Computer Drive Enclosures" },
          "2255": { id: "2255", name: "Computer GPUs" },
          "2256": { id: "2256", name: "Computer Memory (RAM)" },
          "2257": { id: "2257", name: "Computer Motherboards" },
          "2258": { id: "2258", name: "Computer Power Supplies" },
          "2259": { id: "2259", name: "Computer Sound Cards" },
          "2260": { id: "2260", name: "CPU Fans" },
          "2261": { id: "2261", name: "Desktop Cases" },
          "2262": { id: "2262", name: "Heatsinks" },
          "2263": { id: "2263", name: "I/O Adapters" },
          "2264": { id: "2264", name: "PC Water Cooling Accessories" },
          "2265": { id: "2265", name: "PC Water Cooling Kits" },
          "2266": { id: "2266", name: "Thermal Compound" },
          "2267": { id: "2267", name: "Other Computer Parts & Components" }
        }
      },
      "801": {
        id: "801",
        name: "Video Game Merchandise",
        subcategories: {
          "3503": { id: "3503", name: "Interactive Gaming Figures" },
          "3504": { id: "3504", name: "Interactive Video Game Cards" },
          "3505": { id: "3505", name: "Other Video Game Merchandise" }
        }
      },
      "1573": {
        id: "1573",
        name: "Wearables",
        subcategories: {
          "1574": { id: "1574", name: "Smart Watches" },
          "1575": { id: "1575", name: "Smart Watch Accessories" },
          "1576": { id: "1576", name: "Fitness Trackers" }
        }
      },
      "1580": {
        id: "1580",
        name: "Smart Home & Security",
        subcategories: {
          "791": { id: "791", name: "Home surveillance" },
          "1581": { id: "1581", name: "Smart Thermostats" },
          "1582": { id: "1582", name: "Smart Lighting" },
          "1583": { id: "1583", name: "Smart Locks" },
          "1584": { id: "1584", name: "Smart Speakers & Assistants" },
          "1585": { id: "1585", name: "Smart Cleaning Appliances" },
          "1586": { id: "1586", name: "Other" }
        }
      },
      "1587": {
        id: "1587",
        name: "Home Audio",
        subcategories: {
          "788": { id: "788", name: "Other Home Audio" },
          "793": { id: "793", name: "Audio Accessories" },
          "1556": { id: "1556", name: "Studio recording equipment" },
          "1588": { id: "1588", name: "Bluetooth Speakers" },
          "1590": { id: "1590", name: "Docking Stations" },
          "1591": { id: "1591", name: "Radios" },
          "1592": { id: "1592", name: "Portable Stereos & Boomboxes" },
          "2162": { id: "2162", name: "Home Speakers" },
          "2163": { id: "2163", name: "Home Subwoofers" },
          "2197": { id: "2197", name: "Microphone Accessories" },
          "2198": { id: "2198", name: "Microphones" },
          "2199": { id: "2199", name: "DJ Equipment" },
          "2200": { id: "2200", name: "Karaoke Equipment" },
          "2203": { id: "2203", name: "CD Players" },
          "2204": { id: "2204", name: "Record Players" },
          "2269": { id: "2269", name: "Compact Stereos" },
          "2270": { id: "2270", name: "DA Converters" },
          "2271": { id: "2271", name: "Home Audio Amplifiers" },
          "2272": { id: "2272", name: "Home Audio Cables" },
          "2273": { id: "2273", name: "Home Audio CD/SACD Players" },
          "2274": { id: "2274", name: "Home Audio Equalizers" },
          "2275": { id: "2275", name: "Home Audio Integrated Amplifiers" },
          "2276": { id: "2276", name: "Home Audio Interconnects" },
          "2277": { id: "2277", name: "Home Audio Preamplifiers" },
          "2278": { id: "2278", name: "Home Audio Receivers" },
          "2279": { id: "2279", name: "Home Audio Sound Bars" },
          "2280": { id: "2280", name: "Home Audio Tape Decks" },
          "2281": { id: "2281", name: "Home Audio Turntables" },
          "2282": { id: "2282", name: "Music Streamers" },
          "2283": { id: "2283", name: "Radio Tuners" }
        }
      },
      "1593": {
        id: "1593",
        name: "Headphones & MP3 Players",
        subcategories: {
          "789": { id: "789", name: "Headphones" },
          "1577": { id: "1577", name: "MP3 Players" },
          "1594": { id: "1594", name: "Bluetooth Headphones" }
        }
      },
      "1597": {
        id: "1597",
        name: "Tablets & E-readers",
        subcategories: {
          "769": { id: "769", name: "iPad/tablet/ebook readers" },
          "1602": { id: "1602", name: "Tablet Accessories" },
          "2142": { id: "2142", name: "Tablet Cases" },
          "2143": { id: "2143", name: "Tablet Covers" },
          "2144": { id: "2144", name: "Tablet Skins" }
        }
      },
      "1603": {
        id: "1603",
        name: "Drones",
        subcategories: {
          "1604": { id: "1604", name: "Drones" },
          "1605": { id: "1605", name: "Drone Accessories" }
        }
      },
      "1606": {
        id: "1606",
        name: "Virtual Reality",
        subcategories: {
          "1607": { id: "1607", name: "VR Headsets" },
          "1608": { id: "1608", name: "VR Phone Cases" },
          "1609": { id: "1609", name: "VR Accessories" },
          "1610": { id: "1610", name: "VR Games" }
        }
      }
    }
  },
  "1611": {
    id: "1611",
    name: "Toys & Collectibles",
    subcategories: {
      "1612": {
        id: "1612",
        name: "Action Figures & Accessories",
        subcategories: {
          "1613": { id: "1613", name: "Action Figures" },
          "1616": { id: "1616", name: "Action Figure Accessories" },
          "1618": { id: "1618", name: "Action Figure Playsets" }
        }
      },
      "1619": {
        id: "1619",
        name: "Dolls & Accessories",
        subcategories: {
          "1620": { id: "1620", name: "Fashion Dolls" },
          "1621": { id: "1621", name: "Baby Dolls" },
          "1622": { id: "1622", name: "Interactive Dolls & Pets" },
          "1623": { id: "1623", name: "Dollhouses & Play Sets" },
          "1624": { id: "1624", name: "Dollhouse Furniture & Accessories" },
          "1625": { id: "1625", name: "Doll Clothes" },
          "1626": { id: "1626", name: "Doll Accessories" },
          "1627": { id: "1627", name: "Mini Dolls & Playsets" },
          "1628": { id: "1628", name: "Play Animals" }
        }
      },
      "1629": {
        id: "1629",
        name: "Collectibles & Hobbies",
        subcategories: {
          "1631": { id: "1631", name: "Model Vehicles" },
          "1632": { id: "1632", name: "Model Kits" },
          "1633": { id: "1633", name: "Squishies" },
          "1634": { id: "1634", name: "Figurines" },
          "1635": { id: "1635", name: "Glass" },
          "1636": { id: "1636", name: "Souvenirs & Memorabilia" },
          "1637": { id: "1637", name: "Porcelain" },
          "1638": { id: "1638", name: "Dolls" },
          "1639": { id: "1639", name: "Arcade" },
          "1640": { id: "1640", name: "Autographs" },
          "1641": { id: "1641", name: "Comics" },
          "1642": { id: "1642", name: "Paper Collectibles" },
          "1643": { id: "1643", name: "Keychains" },
          "1644": { id: "1644", name: "Pins" },
          "1645": { id: "1645", name: "Rocks, Fossils & Minerals" },
          "1646": { id: "1646", name: "Bags & Totes" },
          "1647": { id: "1647", name: "Other" },
          "2209": { id: "2209", name: "Bobbleheads" },
          "2210": { id: "2210", name: "Toy Statues" },
          "3569": { id: "3569", name: "Photocards" }
        }
      },
      "1648": {
        id: "1648",
        name: "Building Toys",
        subcategories: {
          "1650": { id: "1650", name: "Stacking Blocks" },
          "1651": { id: "1651", name: "Wooden Blocks" },
          "1652": { id: "1652", name: "Magnetic Construction" },
          "1653": { id: "1653", name: "Building Kit Accessories" },
          "2211": { id: "2211", name: "LEGO Toys" },
          "2212": { id: "2212", name: "Toy Building Blocks" }
        }
      },
      "1654": {
        id: "1654",
        name: "Electronics for Kids",
        subcategories: {
          "1656": { id: "1656", name: "Electronic Games" },
          "1657": { id: "1657", name: "Kids Headphones" },
          "1660": { id: "1660", name: "Toy Walkie Talkies" },
          "1661": { id: "1661", name: "Kids Computer & Tablet Accessories" },
          "1663": { id: "1663", name: "Kids Telescopes" },
          "1664": { id: "1664", name: "Wind-Up & Walking Toys" },
          "1665": { id: "1665", name: "Toy Cameras" },
          "1666": { id: "1666", name: "Kids Watches" },
          "1667": { id: "1667", name: "Other" },
          "2213": { id: "2213", name: "Kids Computers" },
          "2214": { id: "2214", name: "Kids Tablets" },
          "2215": { id: "2215", name: "Kids Karaoke" },
          "2216": { id: "2216", name: "Kids Music Players" },
          "2217": { id: "2217", name: "Toy Electric Pets" },
          "2218": { id: "2218", name: "Toy Robots" },
          "2219": { id: "2219", name: "Toy Alarm Clocks" },
          "2220": { id: "2220", name: "Toy Phones" }
        }
      },
      "1668": {
        id: "1668",
        name: "Games & Puzzles",
        subcategories: {
          "1669": { id: "1669", name: "Board Games" },
          "1670": { id: "1670", name: "Card Games" },
          "1671": { id: "1671", name: "Chess & Checkers" },
          "1673": { id: "1673", name: "Tile Games" },
          "1674": { id: "1674", name: "Stacking Games" },
          "1675": { id: "1675", name: "Game Tables" },
          "1676": { id: "1676", name: "Game Accessories" },
          "1677": { id: "1677", name: "Jigsaw Puzzles" },
          "1678": { id: "1678", name: "Wooden Puzzles" },
          "1679": { id: "1679", name: "3-D Puzzles" },
          "1680": { id: "1680", name: "Dice Games" },
          "1681": { id: "1681", name: "Sudoku Puzzles" },
          "1682": { id: "1682", name: "Handheld Games" },
          "1683": { id: "1683", name: "Lawn Games" }
        }
      },
      "1684": {
        id: "1684",
        name: "Sports & Outdoor Play",
        subcategories: {
          "1686": { id: "1686", name: "Bubble Toys" },
          "1687": { id: "1687", name: "NERF & Blaster Guns" },
          "1688": { id: "1688", name: "NERF & Blaster Darts" },
          "1689": { id: "1689", name: "Bounce Houses" },
          "1690": { id: "1690", name: "Toy Kites" },
          "1692": { id: "1692", name: "Sand & Water Toys" },
          "1693": { id: "1693", name: "Play Sets & Playhouses" },
          "1694": { id: "1694", name: "Swing Sets" },
          "1695": { id: "1695", name: "Swing Set Accessories" },
          "1696": { id: "1696", name: "Trampolines" },
          "1697": { id: "1697", name: "Nature Exploration Toys" },
          "1700": { id: "1700", name: "Sleds & Snow Toys" },
          "1701": { id: "1701", name: "Ball Pits" },
          "1702": { id: "1702", name: "Pogo Sticks & Hoppers" },
          "1703": { id: "1703", name: "Other Outdoor Toys" },
          "2221": { id: "2221", name: "Playground Balls" },
          "2222": { id: "2222", name: "Toy Boomerangs" },
          "2223": { id: "2223", name: "Toy Frisbees" },
          "2224": { id: "2224", name: "Kids Wagons" },
          "2225": { id: "2225", name: "Scooters" },
          "2226": { id: "2226", name: "Tricycles" },
          "2227": { id: "2227", name: "Kids Helmets" },
          "2228": { id: "2228", name: "Kids Protective Pads" },
          "2229": { id: "2229", name: "Kids Hoverboards" },
          "2230": { id: "2230", name: "Kids Skateboards" },
          "2231": { id: "2231", name: "Kids Skates" }
        }
      },
      "1704": {
        id: "1704",
        name: "Remote Control Toys & Vehicles",
        subcategories: {
          "1705": { id: "1705", name: "Remote Control Vehicles & Animals" },
          "1706": { id: "1706", name: "Kids Drones & Flying Toys" },
          "1707": { id: "1707", name: "Play Vehicles" },
          "1708": { id: "1708", name: "Racetracks & Playsets" },
          "1709": { id: "1709", name: "Robotics" },
          "1710": { id: "1710", name: "Trains & Train Sets" },
          "1711": { id: "1711", name: "Toy Vehicle Accessories" }
        }
      },
      "1712": {
        id: "1712",
        name: "Stuffed Animals & Plush",
        subcategories: {
          "1713": { id: "1713", name: "Stuffed Animals" },
          "1714": { id: "1714", name: "Stuffed Animal Accessories" },
          "1715": { id: "1715", name: "Beanbag Plushies" },
          "1716": { id: "1716", name: "Plush Puppets" },
          "1717": { id: "1717", name: "Plush Figures" },
          "1719": { id: "1719", name: "Plush Purses & Accessories" },
          "2232": { id: "2232", name: "Character Blankets" },
          "2233": { id: "2233", name: "Character Pillows" }
        }
      },
      "1720": {
        id: "1720",
        name: "Arts & Crafts",
        subcategories: {
          "1721": { id: "1721", name: "Craft Kits" },
          "1722": { id: "1722", name: "Clay, Dough & Pottery Kits" },
          "1723": { id: "1723", name: "Drawing & Coloring" },
          "1724": { id: "1724", name: "Easels & Art Tables" },
          "1725": { id: "1725", name: "Jewelry & Bead Kits" },
          "1727": { id: "1727", name: "Stickers" },
          "1729": { id: "1729", name: "Kids Scissors" },
          "1730": { id: "1730", name: "Aprons & Smocks" },
          "2234": { id: "2234", name: "Glue" },
          "2235": { id: "2235", name: "Paste" }
        }
      },
      "1731": {
        id: "1731",
        name: "Baby & Toddler Toys",
        subcategories: {
          "1733": { id: "1733", name: "Soft & Plush Toys" },
          "1734": { id: "1734", name: "Soothers" },
          "1735": { id: "1735", name: "Car Seat & Stroller Toys" },
          "1736": { id: "1736", name: "Baby Learning Toys" },
          "1737": { id: "1737", name: "Push & Pull Toys" },
          "1738": { id: "1738", name: "Baby & Toddler Books" },
          "1739": { id: "1739", name: "Baby & Toddler Blocks" },
          "1740": { id: "1740", name: "Shape & Color Sorters" },
          "1741": { id: "1741", name: "Bath Toys" },
          "1742": { id: "1742", name: "Baby Music & Sound Toys" },
          "1743": { id: "1743", name: "Crib Toys" },
          "1744": { id: "1744", name: "Other" },
          "2237": { id: "2237", name: "Baby Rattles" },
          "2238": { id: "2238", name: "Baby Teethers" }
        }
      },
      "1745": {
        id: "1745",
        name: "Learning & Education Toys",
        subcategories: {
          "1746": { id: "1746", name: "Music & Art Learning Toys" },
          "1747": { id: "1747", name: "Math Toys" },
          "1748": { id: "1748", name: "Counting Toys" },
          "1749": { id: "1749", name: "Alphabet Toys" },
          "1750": { id: "1750", name: "Reading & Writing Toys" },
          "1751": { id: "1751", name: "Geography & History Toys" },
          "1752": { id: "1752", name: "Engineering Toys" },
          "1753": { id: "1753", name: "STEM Toys" },
          "1754": { id: "1754", name: "Science Toys" },
          "1755": { id: "1755", name: "Bilingual Toys" },
          "1756": { id: "1756", name: "Special Needs Learning Toys" },
          "1757": { id: "1757", name: "Learning & Development Toys" },
          "1758": { id: "1758", name: "Electronic Learning Toys" }
        }
      },
      "1759": {
        id: "1759",
        name: "Dress Up & Pretend Play",
        subcategories: {
          "1760": { id: "1760", name: "Play Cooking & Baking" },
          "1762": { id: "1762", name: "Play Tool Sets" },
          "1763": { id: "1763", name: "Toddler & Baby Costumes" },
          "1764": { id: "1764", name: "Kids Costumes" },
          "1765": { id: "1765", name: "Playhouses" },
          "1766": { id: "1766", name: "Spy Gear" },
          "1767": { id: "1767", name: "Puppets" },
          "1768": { id: "1768", name: "Play Medical Toys" },
          "1769": { id: "1769", name: "Play Gardening Toys" },
          "1770": { id: "1770", name: "Other" },
          "2239": { id: "2239", name: "Play Teepees" },
          "2240": { id: "2240", name: "Play Tents" },
          "2241": { id: "2241", name: "Play Tunnels" }
        }
      },
      "1771": {
        id: "1771",
        name: "Novelty & Gag Toys",
        subcategories: {
          "1772": { id: "1772", name: "Fidget Toys" },
          "1773": { id: "1773", name: "Fortune Telling Toys" },
          "1774": { id: "1774", name: "Gag Toys & Practical Jokes" },
          "1775": { id: "1775", name: "Juggling Sets" },
          "1776": { id: "1776", name: "Magic Kits & Accessories" },
          "1777": { id: "1777", name: "Novelty Spinning Tops" },
          "1779": { id: "1779", name: "Novelty Surprise Toys" },
          "2242": { id: "2242", name: "Toy Putty" },
          "2243": { id: "2243", name: "Toy Slime" }
        }
      },
      "1780": {
        id: "1780",
        name: "Trading Cards",
        subcategories: {
          "1789": { id: "1789", name: "Other Trading Cards" },
          "3506": { id: "3506", name: "Booster Packs" },
          "3507": { id: "3507", name: "Trading Card Boxes" },
          "3508": { id: "3508", name: "Trading Card Decks" },
          "3509": { id: "3509", name: "Single Cards" },
          "3510": { id: "3510", name: "Trading Card Tins" }
        }
      },
      "1790": {
        id: "1790",
        name: "Vintage & Antique Toys",
        subcategories: {
          "1791": { id: "1791", name: "Dolls" },
          "1792": { id: "1792", name: "Games" },
          "1793": { id: "1793", name: "Animals" },
          "1794": { id: "1794", name: "Action Figures" },
          "1795": { id: "1795", name: "Children" },
          "1796": { id: "1796", name: "Cars" },
          "1797": { id: "1797", name: "Puzzles" },
          "1798": { id: "1798", name: "Sports" },
          "1799": { id: "1799", name: "Blocks" },
          "1800": { id: "1800", name: "Electronics" },
          "1801": { id: "1801", name: "Antique Toys" },
          "1802": { id: "1802", name: "Other" }
        }
      },
      "1803": {
        id: "1803",
        name: "Vintage & Antique Collectibles",
        subcategories: {
          "1804": { id: "1804", name: "Model Vehicles" },
          "1805": { id: "1805", name: "Model Kits" },
          "1806": { id: "1806", name: "Figurines" },
          "1807": { id: "1807", name: "Glass" },
          "1808": { id: "1808", name: "Souvenirs & Memorabilia" },
          "1809": { id: "1809", name: "Porcelain" },
          "1810": { id: "1810", name: "Arcade" },
          "1811": { id: "1811", name: "Paper Collectibles" },
          "1812": { id: "1812", name: "Antique Collectibles" },
          "1813": { id: "1813", name: "Other" }
        }
      },
      "1814": {
        id: "1814",
        name: "Handmade Toys",
        subcategories: {
          "1815": { id: "1815", name: "Plush" },
          "1816": { id: "1816", name: "Children" },
          "1817": { id: "1817", name: "Waldorf" },
          "1818": { id: "1818", name: "Dolls" },
          "1820": { id: "1820", name: "Food" },
          "1821": { id: "1821", name: "Puzzles" },
          "1822": { id: "1822", name: "Baby" },
          "1823": { id: "1823", name: "Pretend" },
          "1824": { id: "1824", name: "Bears" },
          "1825": { id: "1825", name: "Amigurumi" },
          "1826": { id: "1826", name: "Games" },
          "1828": { id: "1828", name: "Doll clothes" },
          "1829": { id: "1829", name: "Sports" },
          "1830": { id: "1830", name: "Blythe" },
          "1831": { id: "1831", name: "Other" }
        }
      },
      "1832": {
        id: "1832",
        name: "Handmade Dolls & Miniatures",
        subcategories: {
          "1833": { id: "1833", name: "Scale dollhouse miniatures" },
          "1834": { id: "1834", name: "Miniatures" },
          "1835": { id: "1835", name: "Primitive" },
          "1836": { id: "1836", name: "Art dolls" },
          "1837": { id: "1837", name: "Animals" },
          "1838": { id: "1838", name: "Waldorf" },
          "1839": { id: "1839", name: "Plush" },
          "1840": { id: "1840", name: "Soft Sculptures" },
          "1841": { id: "1841", name: "Fantasy" },
          "1842": { id: "1842", name: "Figurines" },
          "1843": { id: "1843", name: "Child friendly" },
          "1844": { id: "1844", name: "Artist bears" },
          "1845": { id: "1845", name: "Amigurumi" },
          "1846": { id: "1846", name: "Human Figure Dolls" },
          "1847": { id: "1847", name: "Scale Models" },
          "1848": { id: "1848", name: "Fashion Doll Apparel" },
          "1849": { id: "1849", name: "Puppets" },
          "1850": { id: "1850", name: "Other" }
        }
      },
      "1851": { id: "1851", name: "Other" },
      "3511": {
        id: "3511",
        name: "Sports Trading Cards",
        subcategories: {
          "1787": { id: "1787", name: "Other Sports Trading Cards" },
          "2596": { id: "2596", name: "Auto Racing Trading Cards" },
          "2597": { id: "2597", name: "Baseball Trading Cards" },
          "2598": { id: "2598", name: "Basketball Trading Cards" },
          "2599": { id: "2599", name: "Boxing Trading Cards" },
          "2600": { id: "2600", name: "Football Trading Cards" },
          "2601": { id: "2601", name: "Hockey Trading Cards" },
          "2602": { id: "2602", name: "Soccer Trading Cards" },
          "3512": { id: "3512", name: "Wrestling Trading Cards" }
        }
      }
    }
  },
  "4": {
    id: "4",
    name: "Home",
    subcategories: {
      "60": {
        id: "60",
        name: "Kids' home store",
        subcategories: {
          "567": { id: "567", name: "Kids' bedding" },
          "568": { id: "568", name: "Kids' flatware" },
          "569": { id: "569", name: "Kids' furniture" },
          "570": { id: "570", name: "Kids' room décor" },
          "571": { id: "571", name: "Nursery décor" },
          "574": { id: "574", name: "Kids' bath" },
          "575": { id: "575", name: "Other" },
          "1862": { id: "1862", name: "Kids' Storage" }
        }
      },
      "61": {
        id: "61",
        name: "Kitchen & dining",
        subcategories: {
          "589": { id: "589", name: "Other" },
          "2069": { id: "2069", name: "Home Brewing Supplies" },
          "2070": { id: "2070", name: "Wine Making Supplies" },
          "2071": { id: "2071", name: "Cutlery Accessories" },
          "2073": { id: "2073", name: "Water Coolers" },
          "2074": { id: "2074", name: "Water Filters" }
        }
      },
      "62": {
        id: "62",
        name: "Bedding",
        subcategories: {
          "593": { id: "593", name: "Quilts" },
          "594": { id: "594", name: "Bed pillows" },
          "596": { id: "596", name: "Bed in a bag" },
          "600": { id: "600", name: "Mattress pads" },
          "601": { id: "601", name: "Inflatable beds" },
          "602": { id: "602", name: "Feather beds" },
          "603": { id: "603", name: "Other" },
          "2075": { id: "2075", name: "Bedspreads" },
          "2076": { id: "2076", name: "Coverlets" },
          "2077": { id: "2077", name: "Comforter Sets" },
          "2078": { id: "2078", name: "Comforters" },
          "2079": { id: "2079", name: "Duvet Covers" },
          "2080": { id: "2080", name: "Duvet Sets" },
          "2081": { id: "2081", name: "Bed Sheets" },
          "2082": { id: "2082", name: "Pillowcases" },
          "2083": { id: "2083", name: "Bed Skirts" },
          "2084": { id: "2084", name: "Shams" },
          "2085": { id: "2085", name: "Decorative Pillows" },
          "2086": { id: "2086", name: "Pillow Covers" },
          "2087": { id: "2087", name: "Pillow Inserts" },
          "2088": { id: "2088", name: "Blankets" },
          "2089": { id: "2089", name: "Throws" }
        }
      },
      "63": {
        id: "63",
        name: "Bath",
        subcategories: {
          "604": { id: "604", name: "Bath linen sets" },
          "605": { id: "605", name: "Bath rugs" },
          "606": { id: "606", name: "Bathroom accessories" },
          "607": { id: "607", name: "Bathroom furniture sets" },
          "608": { id: "608", name: "Towels" },
          "610": { id: "610", name: "Other" }
        }
      },
      "64": {
        id: "64",
        name: "Furniture",
        subcategories: {
          "613": { id: "613", name: "Home bar furniture" },
          "614": { id: "614", name: "Entertainment Centers & TV Stands" }
        }
      },
      "65": {
        id: "65",
        name: "Home decor",
        subcategories: {
          "622": { id: "622", name: "Baskets" },
          "624": { id: "624", name: "Clocks" },
          "625": { id: "625", name: "Decorative pillows" },
          "626": { id: "626", name: "Doormats" },
          "627": { id: "627", name: "Doorstops" },
          "628": { id: "628", name: "Draft stoppers" },
          "630": { id: "630", name: "Home decor accents" },
          "631": { id: "631", name: "Home fragrance" },
          "633": { id: "633", name: "Mirrors" },
          "635": { id: "635", name: "Slipcovers" },
          "636": { id: "636", name: "Tapestries" },
          "637": { id: "637", name: "Window treatments" },
          "638": { id: "638", name: "Vases" },
          "639": { id: "639", name: "Other" },
          "2090": { id: "2090", name: "Area Rugs" },
          "2091": { id: "2091", name: "Rug Pads" },
          "2092": { id: "2092", name: "Candle Holders" },
          "2093": { id: "2093", name: "Candle Warmers" },
          "2094": { id: "2094", name: "Fragrance Oils" },
          "2095": { id: "2095", name: "Home Candles" },
          "2096": { id: "2096", name: "Other Candle Accessories" },
          "2097": { id: "2097", name: "Wax Melts" },
          "2098": { id: "2098", name: "Fireplace Accessories" },
          "2099": { id: "2099", name: "Fireplaces" },
          "2100": { id: "2100", name: "Home Decor Lamps" },
          "2101": { id: "2101", name: "Home Decor Lighting" },
          "2102": { id: "2102", name: "Home Decor Lamp Accessories" },
          "2103": { id: "2103", name: "Photo Albums" },
          "2104": { id: "2104", name: "Picture Frames" },
          "2825": { id: "2825", name: "Aromatherapy Diffusers" }
        }
      },
      "66": {
        id: "66",
        name: "Artwork",
        subcategories: {
          "640": { id: "640", name: "Drawings" },
          "642": { id: "642", name: "Paintings" },
          "643": { id: "643", name: "Photographs" },
          "645": { id: "645", name: "Other" },
          "2105": { id: "2105", name: "Etchings" },
          "2106": { id: "2106", name: "Lithographs" },
          "2107": { id: "2107", name: "Woodcuts" },
          "2108": { id: "2108", name: "Art Prints" },
          "2109": { id: "2109", name: "Posters" }
        }
      },
      "67": {
        id: "67",
        name: "Seasonal decor",
        subcategories: {
          "646": { id: "646", name: "Christmas" },
          "647": { id: "647", name: "Easter" },
          "648": { id: "648", name: "Halloween" },
          "649": { id: "649", name: "Valentine" },
          "650": { id: "650", name: "Patriotic" },
          "651": { id: "651", name: "Thanksgiving" },
          "652": { id: "652", name: "Birthday" },
          "653": { id: "653", name: "St patrick's" },
          "654": { id: "654", name: "Hanukkah" },
          "655": { id: "655", name: "Day of the dead" },
          "656": { id: "656", name: "New year's" },
          "657": { id: "657", name: "Other" }
        }
      },
      "68": {
        id: "68",
        name: "Home appliances",
        subcategories: {
          "658": { id: "658", name: "Air conditioners" },
          "659": { id: "659", name: "Air purifiers" },
          "660": { id: "660", name: "Dehumidifiers" },
          "661": { id: "661", name: "Dishwashers" },
          "662": { id: "662", name: "Garbage disposals" },
          "663": { id: "663", name: "Fans" },
          "665": { id: "665", name: "Garment steamers" },
          "666": { id: "666", name: "Humidifiers" },
          "668": { id: "668", name: "Kitchen appliances" },
          "669": { id: "669", name: "Microwaves" },
          "670": { id: "670", name: "Refrigerators" },
          "671": { id: "671", name: "Space heaters" },
          "2110": { id: "2110", name: "Freezers" },
          "2111": { id: "2111", name: "Ice Makers" },
          "2112": { id: "2112", name: "Ironing Boards" },
          "2113": { id: "2113", name: "Irons" },
          "2114": { id: "2114", name: "Home Floor Care" },
          "2115": { id: "2115", name: "Vacuums" },
          "2116": { id: "2116", name: "Dryers" },
          "2117": { id: "2117", name: "Washer & Dryer Sets" },
          "2118": { id: "2118", name: "Washers" },
          "2119": { id: "2119", name: "Beverage Coolers" },
          "2120": { id: "2120", name: "Wine Coolers" }
        }
      },
      "69": {
        id: "69",
        name: "Storage & organization",
        subcategories: {
          "677": { id: "677", name: "Bathroom storage & organization" },
          "678": { id: "678", name: "Clothing & closet storage" },
          "679": { id: "679", name: "Garage storage & organization" },
          "680": { id: "680", name: "Holiday decor storage" },
          "682": { id: "682", name: "Laundry storage & organization" },
          "684": { id: "684", name: "Trash & recycling" },
          "685": { id: "685", name: "Storage cabinets" },
          "686": { id: "686", name: "Jewelry boxes & organizers" },
          "687": { id: "687", name: "Other" },
          "2121": { id: "2121", name: "Storage Baskets" },
          "2122": { id: "2122", name: "Storage Bins" },
          "2123": { id: "2123", name: "Storage Drawers" },
          "2124": { id: "2124", name: "Storage Racks" },
          "2125": { id: "2125", name: "Storage Shelves" }
        }
      },
      "70": {
        id: "70",
        name: "Cleaning supplies",
        subcategories: {
          "688": { id: "688", name: "Air fresheners" },
          "689": { id: "689", name: "Brushes" },
          "690": { id: "690", name: "Dusting" },
          "691": { id: "691", name: "Gloves" },
          "692": { id: "692", name: "Household cleaners" },
          "693": { id: "693", name: "Mopping" },
          "694": { id: "694", name: "Paper towels" },
          "695": { id: "695", name: "Sponges" },
          "696": { id: "696", name: "Squeegees" },
          "697": { id: "697", name: "Sweeping" },
          "698": { id: "698", name: "Trash bags" },
          "700": { id: "700", name: "Other" }
        }
      },
      "71": { id: "71", name: "Other" },
      "576": {
        id: "576",
        name: "Kitchen Bakeware",
        subcategories: {
          "2297": { id: "2297", name: "Bakeware Sets" },
          "2298": { id: "2298", name: "Baking Sheets" },
          "2299": { id: "2299", name: "Bundt Pans" },
          "2300": { id: "2300", name: "Cake Pans" },
          "2301": { id: "2301", name: "Cookie Sheets" },
          "2302": { id: "2302", name: "Cupcake & Muffin Pans" },
          "2303": { id: "2303", name: "Loaf Pans" },
          "2304": { id: "2304", name: "Pie Tins" }
        }
      },
      "577": {
        id: "577",
        name: "Kitchen Coffee & Espresso Makers",
        subcategories: {
          "2340": { id: "2340", name: "Coffee Drippers" },
          "2341": { id: "2341", name: "Coffee Grinders" },
          "2342": { id: "2342", name: "Coffee Roasters" },
          "2343": { id: "2343", name: "Espresso & Cappuccino Machines" },
          "2344": { id: "2344", name: "Filter Coffee Machines" },
          "2345": { id: "2345", name: "French Presses" },
          "2346": { id: "2346", name: "Milk Frothers" }
        }
      },
      "578": {
        id: "578",
        name: "Kitchen Cookware",
        subcategories: {
          "2347": { id: "2347", name: "Casserole Pans" },
          "2348": { id: "2348", name: "Cookware Sets" },
          "2349": { id: "2349", name: "Dutch Ovens" },
          "2350": { id: "2350", name: "Fry Pans" },
          "2351": { id: "2351", name: "Griddle Pans" },
          "2352": { id: "2352", name: "Grill Pans" },
          "2353": { id: "2353", name: "Saucepans" },
          "2354": { id: "2354", name: "Saut Pans" },
          "2355": { id: "2355", name: "Skillets" },
          "2356": { id: "2356", name: "Steamers" },
          "2357": { id: "2357", name: "Stock Pots & Multipots" },
          "2358": { id: "2358", name: "Tagines" },
          "2359": { id: "2359", name: "Woks" },
          "2360": { id: "2360", name: "Other Cookware" }
        }
      },
      "579": {
        id: "579",
        name: "Kitchen Dinnerware",
        subcategories: {
          "2377": { id: "2377", name: "Appetizer Plates" },
          "2378": { id: "2378", name: "Bowls" },
          "2379": { id: "2379", name: "Dinner Plates" },
          "2380": { id: "2380", name: "Dinnerware Sets" },
          "2381": { id: "2381", name: "Salad Plates" },
          "2382": { id: "2382", name: "Other Dinnerware" }
        }
      },
      "580": {
        id: "580",
        name: "Kitchen Serveware",
        subcategories: {
          "2432": { id: "2432", name: "Beverage Dispensers" },
          "2433": { id: "2433", name: "Butter Dishes" },
          "2434": { id: "2434", name: "Cheese Boards" },
          "2435": { id: "2435", name: "Dessert & Cake Stands" },
          "2436": { id: "2436", name: "Gravy Boats" },
          "2437": { id: "2437", name: "Jugs" },
          "2438": { id: "2438", name: "Pitchers" },
          "2439": { id: "2439", name: "Salad Bowls" },
          "2440": { id: "2440", name: "Serving Baskets" },
          "2441": { id: "2441", name: "Serving Bowls" },
          "2442": { id: "2442", name: "Serving Platters" },
          "2443": { id: "2443", name: "Serving Trays" },
          "2444": { id: "2444", name: "Trivets" }
        }
      },
      "582": {
        id: "582",
        name: "Kitchen & Table Linens",
        subcategories: {
          "2284": { id: "2284", name: "Kitchen Aprons" },
          "2285": { id: "2285", name: "Kitchen Cloth Napkins" },
          "2286": { id: "2286", name: "Kitchen Napkin Holders" },
          "2287": { id: "2287", name: "Kitchen Napkin Rings" },
          "2288": { id: "2288", name: "Kitchen Oven Mitts" },
          "2289": { id: "2289", name: "Kitchen Potholders" },
          "2290": { id: "2290", name: "Kitchen Table Chargers" },
          "2291": { id: "2291", name: "Kitchen Table Linen Sets" },
          "2292": { id: "2292", name: "Kitchen Table Placemats" },
          "2293": { id: "2293", name: "Kitchen Table Runners" },
          "2294": { id: "2294", name: "Kitchen Tablecloths" },
          "2295": { id: "2295", name: "Kitchen Towels" },
          "2296": { id: "2296", name: "Other Kitchen Linens" }
        }
      },
      "584": {
        id: "584",
        name: "Kitchen Utensils",
        subcategories: {
          "2493": { id: "2493", name: "Cooking Food Turners" },
          "2494": { id: "2494", name: "Cooking Ladles" },
          "2495": { id: "2495", name: "Kitchen Basting Brushes" },
          "2496": { id: "2496", name: "Kitchen Choppers" },
          "2497": { id: "2497", name: "Kitchen Colanders" },
          "2498": { id: "2498", name: "Kitchen Graters" },
          "2499": { id: "2499", name: "Kitchen Peelers" },
          "2500": { id: "2500", name: "Kitchen Scoops" },
          "2501": { id: "2501", name: "Kitchen Sifters" },
          "2502": { id: "2502", name: "Kitchen Slicers & Mandolines" },
          "2503": { id: "2503", name: "Kitchen Spatulas" },
          "2504": { id: "2504", name: "Kitchen Spiralizers" },
          "2505": { id: "2505", name: "Kitchen Strainers" },
          "2506": { id: "2506", name: "Kitchen Tongs" },
          "2507": { id: "2507", name: "Kitchen Utensil Sets" },
          "2508": { id: "2508", name: "Kitchen Whisks" },
          "2509": { id: "2509", name: "Kitchen Zesters" },
          "2510": { id: "2510", name: "Lemon Squeezers" },
          "2511": { id: "2511", name: "Measuring Cups" },
          "2512": { id: "2512", name: "Measuring Spoons" },
          "2513": { id: "2513", name: "Pasta Servers" },
          "2514": { id: "2514", name: "Pizza Cutter" },
          "2515": { id: "2515", name: "Potato Mashers" },
          "2516": { id: "2516", name: "Salad Spinners" },
          "2517": { id: "2517", name: "Slotted Spoons" },
          "2518": { id: "2518", name: "Other Kitchen Utensils" }
        }
      },
      "585": {
        id: "585",
        name: "Kitchen Small Appliances",
        subcategories: {
          "2445": { id: "2445", name: "Air Fryers" },
          "2446": { id: "2446", name: "Blenders" },
          "2447": { id: "2447", name: "Chafing Dishes" },
          "2448": { id: "2448", name: "Chocolate Fountains" },
          "2449": { id: "2449", name: "Contact Grills" },
          "2450": { id: "2450", name: "Deep Fryers" },
          "2451": { id: "2451", name: "Electric Griddles" },
          "2452": { id: "2452", name: "Electric Skillets" },
          "2453": { id: "2453", name: "Food Processors" },
          "2454": { id: "2454", name: "Food Warming Trays" },
          "2455": { id: "2455", name: "Hand Blenders" },
          "2456": { id: "2456", name: "Hand Mixers" },
          "2457": { id: "2457", name: "Ice Cream Makers" },
          "2458": { id: "2458", name: "Juicers" },
          "2459": { id: "2459", name: "Kitchen Burners" },
          "2460": { id: "2460", name: "Kitchen Hot Plates" },
          "2461": { id: "2461", name: "Pasta Makers" },
          "2462": { id: "2462", name: "Popcorn Makers" },
          "2463": { id: "2463", name: "Pressure Cookers" },
          "2464": { id: "2464", name: "Rice Cookers" },
          "2465": { id: "2465", name: "Slow Cookers" },
          "2466": { id: "2466", name: "Soda Makers" },
          "2467": { id: "2467", name: "Sous Vide" },
          "2468": { id: "2468", name: "Stand Mixers" },
          "2470": { id: "2470", name: "Toaster Ovens" },
          "2471": { id: "2471", name: "Toasters" },
          "2472": { id: "2472", name: "Waffle Makers" },
          "2473": { id: "2473", name: "Other Small Appliances" }
        }
      },
      "586": {
        id: "586",
        name: "Kitchen Storage",
        subcategories: {
          "2474": { id: "2474", name: "Food Storage Bags" },
          "2475": { id: "2475", name: "Food Storage Containers" },
          "2476": { id: "2476", name: "Fruit Baskets" },
          "2477": { id: "2477", name: "Kitchen Bread Boxes" },
          "2478": { id: "2478", name: "Kitchen Canisters" },
          "2479": { id: "2479", name: "Kitchen Cling Films" },
          "2480": { id: "2480", name: "Kitchen Drawers Organizers" },
          "2481": { id: "2481", name: "Kitchen Foils" },
          "2482": { id: "2482", name: "Kitchen Jars" },
          "2483": { id: "2483", name: "Kitchen Pantry Organizers" },
          "2484": { id: "2484", name: "Kitchen Spice Jars" },
          "2485": { id: "2485", name: "Kitchen Spice Racks" },
          "2486": { id: "2486", name: "Kitchen Tote Bags" },
          "2487": { id: "2487", name: "Other Kitchen Storage" }
        }
      },
      "588": {
        id: "588",
        name: "Kitchen Bar & Wine Accessories",
        subcategories: {
          "2315": { id: "2315", name: "Bar Tool Sets" },
          "2316": { id: "2316", name: "Bottle Holders" },
          "2317": { id: "2317", name: "Bottle Openers" },
          "2318": { id: "2318", name: "Coasters" },
          "2319": { id: "2319", name: "Cocktail Shakers" },
          "2320": { id: "2320", name: "Decanters" },
          "2321": { id: "2321", name: "Flasks" },
          "2322": { id: "2322", name: "Ice Buckets" },
          "2323": { id: "2323", name: "Liquor Dispensers" },
          "2324": { id: "2324", name: "Wine Bottle Stoppers" },
          "2325": { id: "2325", name: "Wine Boxes" },
          "2326": { id: "2326", name: "Wine Openers & Corkscrews" },
          "2327": { id: "2327", name: "Wine Racks" },
          "2328": { id: "2328", name: "Other Bar & Wine Accessories" }
        }
      },
      "611": {
        id: "611",
        name: "Bedroom Furniture",
        subcategories: {
          "2833": { id: "2833", name: "Bedroom Benches" },
          "2834": { id: "2834", name: "Bedroom Sets" },
          "2835": { id: "2835", name: "Beds" },
          "2836": { id: "2836", name: "Dressers" },
          "2837": { id: "2837", name: "Headboards" },
          "2838": { id: "2838", name: "Mattresses" },
          "2839": { id: "2839", name: "Nightstands" },
          "2840": { id: "2840", name: "Vanities" },
          "2841": { id: "2841", name: "Vanity Stools" },
          "2842": { id: "2842", name: "Wardrobes & Armoires" },
          "2843": { id: "2843", name: "Other Bedroom Furniture" }
        }
      },
      "612": {
        id: "612",
        name: "Kitchen Furniture",
        subcategories: {
          "2407": { id: "2407", name: "Dining Benches" },
          "2408": { id: "2408", name: "Dining Chairs" },
          "2409": { id: "2409", name: "Dining Sets" },
          "2410": { id: "2410", name: "Dining Tables" },
          "2411": { id: "2411", name: "Kitchen Bar Stools" },
          "2412": { id: "2412", name: "Other Dining Furniture" }
        }
      },
      "615": {
        id: "615",
        name: "Home Office Furniture",
        subcategories: {
          "2852": { id: "2852", name: "Bookcases" },
          "2853": { id: "2853", name: "Desks" },
          "2854": { id: "2854", name: "Filing Cabinets" },
          "2855": { id: "2855", name: "Office Cabinets" },
          "2856": { id: "2856", name: "Office Chairs" },
          "2857": { id: "2857", name: "Office Chair Mats" },
          "2858": { id: "2858", name: "Office Shelves" },
          "2859": { id: "2859", name: "Other Home Office Furniture" }
        }
      },
      "616": {
        id: "616",
        name: "Living Room Furniture",
        subcategories: {
          "2860": { id: "2860", name: "Accent Chairs" },
          "2861": { id: "2861", name: "Cabinets" },
          "2862": { id: "2862", name: "Coffee Tables" },
          "2863": { id: "2863", name: "Console Tables" },
          "2864": { id: "2864", name: "Futons" },
          "2865": { id: "2865", name: "Living Room Sets" },
          "2867": { id: "2867", name: "Ottomans" },
          "2868": { id: "2868", name: "Recliners" },
          "2871": { id: "2871", name: "Sofas" },
          "2872": { id: "2872", name: "TV Mounts" },
          "2873": { id: "2873", name: "Other Living Room Furniture" }
        }
      },
      "617": {
        id: "617",
        name: "Bathroom Furniture",
        subcategories: {
          "2826": { id: "2826", name: "Bathroom Cabinets" },
          "2827": { id: "2827", name: "Bathroom Etagere" },
          "2828": { id: "2828", name: "Bathroom Organizers" },
          "2829": { id: "2829", name: "Bathroom Shelves" },
          "2830": { id: "2830", name: "Bathroom Vanities" },
          "2831": { id: "2831", name: "Hampers" },
          "2832": { id: "2832", name: "Other Bathroom Storage" }
        }
      },
      "618": {
        id: "618",
        name: "Other Furniture",
        subcategories: {
          "620": { id: "620", name: "Other Furniture Accessories" }
        }
      },
      "619": {
        id: "619",
        name: "Furniture Hardware & Parts",
        subcategories: {
          "2844": { id: "2844", name: "Backplates" },
          "2845": { id: "2845", name: "Drawer Slides" },
          "2846": { id: "2846", name: "Furniture Legs" },
          "2847": { id: "2847", name: "Hinges" },
          "2848": { id: "2848", name: "Knobs" },
          "2849": { id: "2849", name: "Latches" },
          "2850": { id: "2850", name: "Pulls & Handles" },
          "2851": { id: "2851", name: "Other Furniture Hardware & Parts" }
        }
      },
      "1853": {
        id: "1853",
        name: "Party Supplies",
        subcategories: {
          "1854": { id: "1854", name: "Greeting Cards & Invitations" },
          "1855": { id: "1855", name: "Gift Wrapping Supplies" },
          "1856": { id: "1856", name: "Party Decorations" },
          "1857": { id: "1857", name: "Balloons" },
          "1858": { id: "1858", name: "Party Tableware" },
          "1859": { id: "1859", name: "Piñatas" },
          "1860": { id: "1860", name: "Party Favors" },
          "2244": { id: "2244", name: "Party Hats" },
          "2245": { id: "2245", name: "Party Masks" }
        }
      },
      "2072": {
        id: "2072",
        name: "Kitchen Cutlery",
        subcategories: {
          "2361": { id: "2361", name: "Cheese Knives" },
          "2362": { id: "2362", name: "Chef's Knives" },
          "2363": { id: "2363", name: "Kitchen Boning Knives" },
          "2364": { id: "2364", name: "Kitchen Bread Knives" },
          "2365": { id: "2365", name: "Kitchen Carving Knives" },
          "2366": { id: "2366", name: "Kitchen Cleavers" },
          "2367": { id: "2367", name: "Kitchen Knife Blocks" },
          "2368": { id: "2368", name: "Kitchen Knife Sets" },
          "2369": { id: "2369", name: "Kitchen Knife Sharpeners" },
          "2370": { id: "2370", name: "Kitchen Knife Storage" },
          "2371": { id: "2371", name: "Kitchen Paring Knives" },
          "2372": { id: "2372", name: "Kitchen Scissors & Shears" },
          "2373": { id: "2373", name: "Kitchen Steak Knives" },
          "2374": { id: "2374", name: "Kitchen Utility Knives" },
          "2375": { id: "2375", name: "Nakiri Knives" },
          "2376": { id: "2376", name: "Santoku Knives" }
        }
      },
      "2305": {
        id: "2305",
        name: "Kitchen Baking & Cake Accessories",
        subcategories: {
          "2306": { id: "2306", name: "Cake Boards" },
          "2307": { id: "2307", name: "Cake Candles" },
          "2308": { id: "2308", name: "Cake Levelers" },
          "2309": { id: "2309", name: "Cake Scrapers" },
          "2310": { id: "2310", name: "Cake Toppers" },
          "2311": { id: "2311", name: "Cookie Cutters" },
          "2312": { id: "2312", name: "Icing Bags" },
          "2313": { id: "2313", name: "Icing Nozzles" },
          "2314": { id: "2314", name: "Rolling Pins" }
        }
      },
      "2329": {
        id: "2329",
        name: "Kitchen Barware",
        subcategories: {
          "2330": { id: "2330", name: "Bar Glasses" },
          "2331": { id: "2331", name: "Beer Glasses" },
          "2332": { id: "2332", name: "Champagne Flutes" },
          "2333": { id: "2333", name: "Cocktail Glasses" },
          "2334": { id: "2334", name: "Highball Glasses" },
          "2335": { id: "2335", name: "Margarita Glasses" },
          "2336": { id: "2336", name: "Martini Glasses" },
          "2337": { id: "2337", name: "Old-Fashioned Glasses" },
          "2338": { id: "2338", name: "Shot Glasses" },
          "2339": { id: "2339", name: "Wine Glasses" }
        }
      },
      "2383": {
        id: "2383",
        name: "Kitchen Drinkware",
        subcategories: {
          "2384": { id: "2384", name: "Coffee Mugs" },
          "2385": { id: "2385", name: "Drinking Glasses" },
          "2386": { id: "2386", name: "Glassware Collections" },
          "2387": { id: "2387", name: "Straws" },
          "2388": { id: "2388", name: "Tea Cups" },
          "2389": { id: "2389", name: "Travel Mugs" },
          "2390": { id: "2390", name: "Tumblers" },
          "2391": { id: "2391", name: "Water Bottles" },
          "2392": { id: "2392", name: "Other Drinkware Accessories" }
        }
      },
      "2393": {
        id: "2393",
        name: "Kitchen Flatware",
        subcategories: {
          "2394": { id: "2394", name: "Butter Knives" },
          "2395": { id: "2395", name: "Chopstick Holders" },
          "2396": { id: "2396", name: "Chopsticks" },
          "2397": { id: "2397", name: "Dinner Knives" },
          "2398": { id: "2398", name: "Flatware Sets" },
          "2399": { id: "2399", name: "Forks" },
          "2400": { id: "2400", name: "Pie Servers" },
          "2401": { id: "2401", name: "Salad Servers" },
          "2402": { id: "2402", name: "Serving Forks" },
          "2403": { id: "2403", name: "Serving Sets" },
          "2404": { id: "2404", name: "Serving Spoons" },
          "2405": { id: "2405", name: "Table Spoons" },
          "2406": { id: "2406", name: "Teaspoons" }
        }
      },
      "2413": {
        id: "2413",
        name: "Kitchen Gadgets & Tools",
        subcategories: {
          "2414": { id: "2414", name: "Can Openers" },
          "2415": { id: "2415", name: "Cooking Funnels" },
          "2416": { id: "2416", name: "Cooking Thermometers" },
          "2417": { id: "2417", name: "Garlic Presses" },
          "2418": { id: "2418", name: "Ice Cube Trays" },
          "2419": { id: "2419", name: "Kitchen Cutting Boards" },
          "2420": { id: "2420", name: "Kitchen Mortar & Pestles" },
          "2421": { id: "2421", name: "Kitchen Scales" },
          "2422": { id: "2422", name: "Kitchen Timers" },
          "2423": { id: "2423", name: "Manual Juicers" },
          "2424": { id: "2424", name: "Mixing Bowls" },
          "2425": { id: "2425", name: "Nut & Shell Crackers" },
          "2426": { id: "2426", name: "Oil & Vinegar Dispensers" },
          "2427": { id: "2427", name: "Salt & Pepper Mills" },
          "2428": { id: "2428", name: "Salt & Pepper Shakers" },
          "2429": { id: "2429", name: "Spoon Rests" },
          "2430": { id: "2430", name: "Stove Burner Covers" },
          "2431": { id: "2431", name: "Other Kitchen Gadgets & Tools" }
        }
      },
      "2488": {
        id: "2488",
        name: "Kitchen Tea & Accessories",
        subcategories: {
          "2489": { id: "2489", name: "Electric Kettles" },
          "2490": { id: "2490", name: "Stovetop Kettles" },
          "2491": { id: "2491", name: "Tea Infusers" },
          "2492": { id: "2492", name: "Teapots" }
        }
      }
    }
  },
  "6": {
    id: "6",
    name: "Beauty",
    subcategories: {
      "88": {
        id: "88",
        name: "Bath & body",
        subcategories: {
          "820": { id: "820", name: "Bath" },
          "821": { id: "821", name: "Bathing accessories" },
          "822": { id: "822", name: "Cleansers" },
          "824": { id: "824", name: "Sets" },
          "825": { id: "825", name: "Other" },
          "2172": { id: "2172", name: "Body Scrubs" },
          "2173": { id: "2173", name: "Body Care" }
        }
      },
      "89": {
        id: "89",
        name: "Fragrance",
        subcategories: {
          "826": { id: "826", name: "Women" },
          "827": { id: "827", name: "Men" },
          "828": { id: "828", name: "Kids" },
          "830": { id: "830", name: "Sets" },
          "831": { id: "831", name: "Other" }
        }
      },
      "90": {
        id: "90",
        name: "Hair care",
        subcategories: {
          "832": { id: "832", name: "Conditioners" },
          "833": { id: "833", name: "Hair & scalp treatments" },
          "834": { id: "834", name: "Hair color" },
          "835": { id: "835", name: "Hair loss products" },
          "837": { id: "837", name: "Hair relaxers" },
          "838": { id: "838", name: "Shampoos" },
          "839": { id: "839", name: "Shampoo plus conditioner" },
          "840": { id: "840", name: "Shampoo & conditioner sets" },
          "841": { id: "841", name: "Styling products" },
          "843": { id: "843", name: "Other" },
          "2174": { id: "2174", name: "Hair Perms" },
          "2175": { id: "2175", name: "Hair Texturizers" }
        }
      },
      "91": {
        id: "91",
        name: "Makeup",
        subcategories: {
          "844": { id: "844", name: "Body" },
          "845": { id: "845", name: "Eyes" },
          "846": { id: "846", name: "Face" },
          "847": { id: "847", name: "Lips" },
          "848": { id: "848", name: "Makeup palettes" },
          "849": { id: "849", name: "Makeup remover" },
          "850": { id: "850", name: "Makeup sets" },
          "851": { id: "851", name: "Nails" },
          "853": { id: "853", name: "Other" }
        }
      },
      "92": {
        id: "92",
        name: "Skin care",
        subcategories: {
          "854": { id: "854", name: "Body" },
          "855": { id: "855", name: "Eyes" },
          "856": { id: "856", name: "Face" },
          "857": { id: "857", name: "Feet" },
          "859": { id: "859", name: "Lips" },
          "860": { id: "860", name: "Maternity" },
          "861": { id: "861", name: "Sets & kits" },
          "862": { id: "862", name: "Sun" },
          "863": { id: "863", name: "Other" },
          "2176": { id: "2176", name: "Hand Care" },
          "2177": { id: "2177", name: "Nail Care" }
        }
      },
      "93": {
        id: "93",
        name: "Tools & accessories",
        subcategories: {
          "866": { id: "866", name: "Cotton & swabs" },
          "867": { id: "867", name: "Epilators" },
          "868": { id: "868", name: "Hair coloring tools" },
          "869": { id: "869", name: "Hair styling tools" },
          "871": { id: "871", name: "Mirrors" },
          "872": { id: "872", name: "Nail tools" },
          "873": { id: "873", name: "Toiletry kits" },
          "874": { id: "874", name: "Tweezers" },
          "875": { id: "875", name: "Waxing" },
          "876": { id: "876", name: "Other" },
          "2179": { id: "2179", name: "Cosmetic Cases" },
          "2180": { id: "2180", name: "Makeup Brushes" },
          "2181": { id: "2181", name: "Makeup Sponges" }
        }
      },
      "94": { id: "94", name: "Other" }
    }
  },
  "3": {
    id: "3",
    name: "Kids",
    subcategories: {
      "48": {
        id: "48",
        name: "Bathing & skin care",
        subcategories: {
          "472": { id: "472", name: "Bubble bath" },
          "473": { id: "473", name: "Conditioners" },
          "475": { id: "475", name: "Non-slip bath mats" },
          "476": { id: "476", name: "Shampoo" },
          "477": { id: "477", name: "Skin care" },
          "479": { id: "479", name: "Travel bathing kits" },
          "481": { id: "481", name: "Other" },
          "2031": { id: "2031", name: "Kids Bathing Seats" },
          "2032": { id: "2032", name: "Kids Bathing Tubs" },
          "2033": { id: "2033", name: "Kids Grooming Kits" },
          "2034": { id: "2034", name: "Baby Care Kits" },
          "2035": { id: "2035", name: "Kids Bath Soaps" },
          "2036": { id: "2036", name: "Kids Facial Cleansers" },
          "2037": { id: "2037", name: "Kids Bathing Towels" },
          "2038": { id: "2038", name: "Kids Washcloths" }
        }
      },
      "49": {
        id: "49",
        name: "Car seats & accessories",
        subcategories: {
          "482": { id: "482", name: "Car seats" },
          "483": { id: "483", name: "Accessories" },
          "484": { id: "484", name: "Other" }
        }
      },
      "50": {
        id: "50",
        name: "Diapering",
        subcategories: {
          "485": { id: "485", name: "Disposable diapers" },
          "486": { id: "486", name: "Cloth diapers" },
          "488": { id: "488", name: "Changing tables" },
          "490": { id: "490", name: "Diaper bags" },
          "491": { id: "491", name: "Changing kits" },
          "493": { id: "493", name: "Diaper stackers & caddies" },
          "496": { id: "496", name: "Other" },
          "2039": { id: "2039", name: "Baby Changing Pad Covers" },
          "2040": { id: "2040", name: "Baby Changing Pads" },
          "2041": { id: "2041", name: "Baby Wipe Holders" },
          "2042": { id: "2042", name: "Baby Wipes" },
          "2043": { id: "2043", name: "Diaper Pail Refills" },
          "2044": { id: "2044", name: "Diaper Pails" },
          "2045": { id: "2045", name: "Baby Lotions" },
          "2046": { id: "2046", name: "Baby Powders" }
        }
      },
      "51": {
        id: "51",
        name: "Feeding",
        subcategories: {
          "499": { id: "499", name: "Storage & containers" },
          "500": { id: "500", name: "Gift sets" },
          "506": { id: "506", name: "Other" },
          "2047": { id: "2047", name: "Kids Booster Seats" },
          "2048": { id: "2048", name: "Kids Highchairs" },
          "2049": { id: "2049", name: "Baby Bottles" },
          "2050": { id: "2050", name: "Feeding Bibs" },
          "2051": { id: "2051", name: "Kids Feeding Accessories" },
          "2052": { id: "2052", name: "Kids Sippy Cups" },
          "2053": { id: "2053", name: "Pacifiers" }
        }
      },
      "52": {
        id: "52",
        name: "Gear",
        subcategories: {
          "507": { id: "507", name: "Baby Activity Centers" },
          "509": { id: "509", name: "Baby seats" },
          "513": { id: "513", name: "Playard bedding" },
          "514": { id: "514", name: "Playards" },
          "515": { id: "515", name: "Shopping cart covers" },
          "517": { id: "517", name: "Travel beds" },
          "518": { id: "518", name: "Walkers" },
          "519": { id: "519", name: "Other" },
          "2054": { id: "2054", name: "Baby Gyms" },
          "2055": { id: "2055", name: "Baby Playmats" },
          "2056": { id: "2056", name: "Baby Carriers" },
          "2057": { id: "2057", name: "Baby Carrier Backpacks" },
          "2058": { id: "2058", name: "Bicycle Child Seats" },
          "2059": { id: "2059", name: "Bicycle Child Trailers" },
          "2060": { id: "2060", name: "Baby Bouncers" },
          "2061": { id: "2061", name: "Baby Jumpers" },
          "2062": { id: "2062", name: "Baby Swings" }
        }
      },
      "53": {
        id: "53",
        name: "Health & baby care",
        subcategories: {
          "520": { id: "520", name: "Humidifiers" },
          "521": { id: "521", name: "Nail care" },
          "522": { id: "522", name: "Nasal aspirators" },
          "523": { id: "523", name: "Sun protection" },
          "524": { id: "524", name: "Teethers" },
          "525": { id: "525", name: "Teething relief" },
          "526": { id: "526", name: "Thermometers" },
          "527": { id: "527", name: "Toothbrushes" },
          "528": { id: "528", name: "Other" }
        }
      },
      "54": {
        id: "54",
        name: "Nursery",
        subcategories: {
          "529": { id: "529", name: "Bedding" },
          "530": { id: "530", name: "Furniture" },
          "531": { id: "531", name: "Nursery decor" },
          "532": { id: "532", name: "Other" }
        }
      },
      "55": {
        id: "55",
        name: "Potty training",
        subcategories: {
          "533": { id: "533", name: "Seat covers" },
          "535": { id: "535", name: "Step stools" },
          "536": { id: "536", name: "Training pants" },
          "537": { id: "537", name: "Travel potties" },
          "538": { id: "538", name: "Other" },
          "2063": { id: "2063", name: "Potty Training Seats" },
          "2064": { id: "2064", name: "Potty Training Chairs" }
        }
      },
      "56": {
        id: "56",
        name: "Pregnancy & maternity",
        subcategories: {
          "540": { id: "540", name: "Family planning tests" },
          "541": { id: "541", name: "Maternity pillows" },
          "542": { id: "542", name: "Prenatal monitoring devices" },
          "543": { id: "543", name: "Other" },
          "2065": { id: "2065", name: "Breastfeeding Pillows" },
          "2066": { id: "2066", name: "Breastfeeding Stools" }
        }
      },
      "57": {
        id: "57",
        name: "Safety",
        subcategories: {
          "544": { id: "544", name: "Bathroom safety" },
          "545": { id: "545", name: "Cabinet locks & straps" },
          "546": { id: "546", name: "Crib netting" },
          "547": { id: "547", name: "Edge & corner guards" },
          "548": { id: "548", name: "Electrical safety" },
          "549": { id: "549", name: "Gates & doorways" },
          "551": { id: "551", name: "Kitchen safety" },
          "552": { id: "552", name: "Monitors" },
          "553": { id: "553", name: "Outdoor safety" },
          "554": { id: "554", name: "Rails & rail guards" },
          "555": { id: "555", name: "Safety caps" },
          "556": { id: "556", name: "Sleep positioners" },
          "557": { id: "557", name: "Other" },
          "2067": { id: "2067", name: "Kids Safety Harnesses" },
          "2068": { id: "2068", name: "Kids Safety Leashes" }
        }
      },
      "58": {
        id: "58",
        name: "Strollers",
        subcategories: {
          "558": { id: "558", name: "Accessories" },
          "559": { id: "559", name: "Joggers" },
          "560": { id: "560", name: "Lightweight" },
          "561": { id: "561", name: "Prams" },
          "562": { id: "562", name: "Standard" },
          "563": { id: "563", name: "Tandem" },
          "564": { id: "564", name: "Travel systems" },
          "565": { id: "565", name: "Other" }
        }
      },
      "59": { id: "59", name: "Other" },
      "1870": {
        id: "1870",
        name: "Girls accessories",
        subcategories: {
          "1887": { id: "1887", name: "Girls 0-24 mos" },
          "1896": { id: "1896", name: "Girls 2T-5T" },
          "1905": { id: "1905", name: "Girls (4+)" }
        }
      },
      "1871": {
        id: "1871",
        name: "Girls bottoms",
        subcategories: {
          "1888": { id: "1888", name: "Girls 0-24 mos" },
          "1897": { id: "1897", name: "Girls 2T-5T" },
          "1906": { id: "1906", name: "Girls (4+)" }
        }
      },
      "1872": {
        id: "1872",
        name: "Girls coats & jackets",
        subcategories: {
          "1889": { id: "1889", name: "Girls 0-24 mos" },
          "1898": { id: "1898", name: "Girls 2T-5T" },
          "1907": { id: "1907", name: "Girls (4+)" }
        }
      },
      "1873": {
        id: "1873",
        name: "Girls dresses",
        subcategories: {
          "1890": { id: "1890", name: "Girls 0-24 mos" },
          "1899": { id: "1899", name: "Girls 2T-5T" },
          "1908": { id: "1908", name: "Girls (4+)" }
        }
      },
      "1874": {
        id: "1874",
        name: "Girls one-pieces",
        subcategories: {
          "1891": { id: "1891", name: "Girls 0-24 mos" },
          "1900": { id: "1900", name: "Girls 2T-5T" }
        }
      },
      "1875": {
        id: "1875",
        name: "Girls shoes",
        subcategories: {
          "1892": { id: "1892", name: "Girls 0-24 mos" },
          "1901": { id: "1901", name: "Girls 2T-5T" },
          "1909": { id: "1909", name: "Girls (4+)" }
        }
      },
      "1876": {
        id: "1876",
        name: "Girls swimwear",
        subcategories: {
          "1893": { id: "1893", name: "Girls 0-24 mos" },
          "1902": { id: "1902", name: "Girls 2T-5T" },
          "1910": { id: "1910", name: "Girls (4+)" }
        }
      },
      "1877": {
        id: "1877",
        name: "Girls tops & t-shirts",
        subcategories: {
          "1894": { id: "1894", name: "Girls 0-24 mos" },
          "1903": { id: "1903", name: "Girls 2T-5T" },
          "1911": { id: "1911", name: "Girls (4+)" }
        }
      },
      "1878": {
        id: "1878",
        name: "Girls other",
        subcategories: {
          "1895": { id: "1895", name: "Girls 0-24 mos" },
          "1904": { id: "1904", name: "Girls 2T-5T" },
          "1912": { id: "1912", name: "Girls (4+)" }
        }
      },
      "1879": {
        id: "1879",
        name: "Boys accessories",
        subcategories: {
          "1913": { id: "1913", name: "Boys 0-24 mos" },
          "1921": { id: "1921", name: "Boys 2T-5T" },
          "1929": { id: "1929", name: "Boys (4+)" }
        }
      },
      "1880": {
        id: "1880",
        name: "Boys bottoms",
        subcategories: {
          "1914": { id: "1914", name: "Boys 0-24 mos" },
          "1922": { id: "1922", name: "Boys 2T-5T" },
          "1930": { id: "1930", name: "Boys (4+)" }
        }
      },
      "1881": {
        id: "1881",
        name: "Boys coats & jackets",
        subcategories: {
          "1915": { id: "1915", name: "Boys 0-24 mos" },
          "1923": { id: "1923", name: "Boys 2T-5T" },
          "1931": { id: "1931", name: "Boys (4+)" }
        }
      },
      "1882": {
        id: "1882",
        name: "Boys one-pieces",
        subcategories: {
          "1916": { id: "1916", name: "Boys 0-24 mos" },
          "1924": { id: "1924", name: "Boys 2T-5T" }
        }
      },
      "1883": {
        id: "1883",
        name: "Boys swimwear",
        subcategories: {
          "1918": { id: "1918", name: "Boys 0-24 mos" },
          "1926": { id: "1926", name: "Boys 2T-5T" },
          "1933": { id: "1933", name: "Boys (4+)" }
        }
      },
      "1884": {
        id: "1884",
        name: "Boys shoes",
        subcategories: {
          "1917": { id: "1917", name: "Boys 0-24 mos" },
          "1925": { id: "1925", name: "Boys 2T-5T" },
          "1932": { id: "1932", name: "Boys (4+)" }
        }
      },
      "1885": {
        id: "1885",
        name: "Boys tops & t-shirts",
        subcategories: {
          "1919": { id: "1919", name: "Boys 0-24 mos" },
          "1927": { id: "1927", name: "Boys 2T-5T" },
          "1934": { id: "1934", name: "Boys (4+)" }
        }
      },
      "1886": {
        id: "1886",
        name: "Boys other",
        subcategories: {
          "1920": { id: "1920", name: "Boys 0-24 mos" },
          "1928": { id: "1928", name: "Boys 2T-5T" },
          "1935": { id: "1935", name: "Boys (4+)" }
        }
      }
    }
  },
  "5": {
    id: "5",
    name: "Vintage & collectibles",
    subcategories: {
      "95": {
        id: "95",
        name: "Jewelry",
        subcategories: {
          "878": { id: "878", name: "Brooch" },
          "879": { id: "879", name: "Necklace" },
          "880": { id: "880", name: "Earrings" },
          "881": { id: "881", name: "Ring" },
          "882": { id: "882", name: "Bracelet" },
          "883": { id: "883", name: "Pendant" },
          "884": { id: "884", name: "Watch" },
          "885": { id: "885", name: "Other" }
        }
      },
      "96": {
        id: "96",
        name: "Clothing",
        subcategories: {
          "886": { id: "886", name: "Dress" },
          "887": { id: "887", name: "Jacket" },
          "888": { id: "888", name: "Shirt" },
          "889": { id: "889", name: "Sweater" },
          "890": { id: "890", name: "Blouse" },
          "891": { id: "891", name: "Skirt" },
          "892": { id: "892", name: "Tshirt" },
          "893": { id: "893", name: "Outerwear" },
          "894": { id: "894", name: "Pants" },
          "895": { id: "895", name: "Shorts" },
          "896": { id: "896", name: "Children" },
          "897": { id: "897", name: "Baby" },
          "898": { id: "898", name: "Swimwear" },
          "899": { id: "899", name: "Tank" },
          "901": { id: "901", name: "Corset" },
          "902": { id: "902", name: "Other" }
        }
      },
      "97": {
        id: "97",
        name: "Home decor",
        subcategories: {
          "903": { id: "903", name: "Wall hanging" },
          "904": { id: "904", name: "Vase" },
          "905": { id: "905", name: "Linens" },
          "906": { id: "906", name: "Lighting" },
          "907": { id: "907", name: "Box" },
          "908": { id: "908", name: "Candle holder" },
          "909": { id: "909", name: "Planter" },
          "910": { id: "910", name: "Bedding" },
          "911": { id: "911", name: "Tray" },
          "912": { id: "912", name: "Pillow" },
          "913": { id: "913", name: "Frame" },
          "914": { id: "914", name: "Basket" },
          "915": { id: "915", name: "Other" }
        }
      },
      "99": {
        id: "99",
        name: "Accessories",
        subcategories: {
          "922": { id: "922", name: "Shoes" },
          "923": { id: "923", name: "Hat" },
          "924": { id: "924", name: "Scarf" },
          "925": { id: "925", name: "Eyewear" },
          "926": { id: "926", name: "Necktie" },
          "927": { id: "927", name: "Belt" },
          "928": { id: "928", name: "Handkerchief" },
          "929": { id: "929", name: "Cuff links" },
          "930": { id: "930", name: "Buckle" },
          "932": { id: "932", name: "Gloves" },
          "933": { id: "933", name: "Apron" },
          "934": { id: "934", name: "Compact" },
          "935": { id: "935", name: "Wallet" },
          "936": { id: "936", name: "Shawl" },
          "937": { id: "937", name: "Keychain" },
          "938": { id: "938", name: "Other" }
        }
      },
      "100": {
        id: "100",
        name: "Housewares",
        subcategories: {
          "939": { id: "939", name: "Glass" },
          "940": { id: "940", name: "Bowl" },
          "941": { id: "941", name: "Cup" },
          "942": { id: "942", name: "Ceramic" },
          "943": { id: "943", name: "Plate" },
          "945": { id: "945", name: "Box" },
          "946": { id: "946", name: "Towel" },
          "947": { id: "947", name: "Table" },
          "948": { id: "948", name: "Coaster" },
          "951": { id: "951", name: "Light" },
          "952": { id: "952", name: "Pot holder" },
          "953": { id: "953", name: "Magnet" },
          "954": { id: "954", name: "Other" }
        }
      },
      "101": {
        id: "101",
        name: "Supplies",
        subcategories: {
          "955": { id: "955", name: "Pattern" },
          "956": { id: "956", name: "Fabric" },
          "957": { id: "957", name: "Button" },
          "958": { id: "958", name: "Trim" },
          "959": { id: "959", name: "Bead" },
          "960": { id: "960", name: "Finding" },
          "961": { id: "961", name: "Cabochon" },
          "962": { id: "962", name: "Charm" },
          "963": { id: "963", name: "Ephemera" },
          "964": { id: "964", name: "Chain" },
          "965": { id: "965", name: "Yarn" },
          "966": { id: "966", name: "Zipper" },
          "967": { id: "967", name: "Other" }
        }
      },
      "102": {
        id: "102",
        name: "Antique",
        subcategories: {
          "968": { id: "968", name: "100 years or older" },
          "969": { id: "969", name: "50 to 75 years" },
          "970": { id: "970", name: "Paper ephemera" },
          "971": { id: "971", name: "Collectibles" },
          "972": { id: "972", name: "75 to 100 years" },
          "973": { id: "973", name: "Home decor" },
          "974": { id: "974", name: "Jewelry" },
          "975": { id: "975", name: "Housewares" },
          "976": { id: "976", name: "Supplies" },
          "977": { id: "977", name: "Serving" },
          "978": { id: "978", name: "Book" },
          "979": { id: "979", name: "Accessories" },
          "980": { id: "980", name: "Furniture" },
          "982": { id: "982", name: "Bags and purses" },
          "983": { id: "983", name: "Electronics" },
          "984": { id: "984", name: "Other" }
        }
      },
      "103": {
        id: "103",
        name: "Paper ephemera",
        subcategories: {
          "985": { id: "985", name: "Postcard" },
          "986": { id: "986", name: "Advertisement" },
          "987": { id: "987", name: "Map" },
          "988": { id: "988", name: "Stamps" },
          "989": { id: "989", name: "Game" },
          "990": { id: "990", name: "Matchbox" },
          "991": { id: "991", name: "Other" }
        }
      },
      "104": {
        id: "104",
        name: "Serving",
        subcategories: {
          "992": { id: "992", name: "Bowl" },
          "993": { id: "993", name: "Glassware" },
          "994": { id: "994", name: "Plate" },
          "995": { id: "995", name: "Flatware" },
          "996": { id: "996", name: "Teacup" },
          "997": { id: "997", name: "Salt and pepper shakers" },
          "998": { id: "998", name: "Pitcher" },
          "999": { id: "999", name: "Cream and sugar set" },
          "1000": { id: "1000", name: "Mug" },
          "1001": { id: "1001", name: "Tray" },
          "1002": { id: "1002", name: "Platter" },
          "1003": { id: "1003", name: "Teapot" },
          "1004": { id: "1004", name: "Casserole" },
          "1005": { id: "1005", name: "Dinnerware set" },
          "1006": { id: "1006", name: "Tumbler" },
          "1007": { id: "1007", name: "Butter dish" },
          "1008": { id: "1008", name: "Other" }
        }
      },
      "106": {
        id: "106",
        name: "Bags and purses",
        subcategories: {
          "1029": { id: "1029", name: "Handbag" },
          "1030": { id: "1030", name: "Purse" },
          "1031": { id: "1031", name: "Clutch" },
          "1032": { id: "1032", name: "Leather" },
          "1034": { id: "1034", name: "Formal" },
          "1035": { id: "1035", name: "Tote" },
          "1036": { id: "1036", name: "Pouch" },
          "1037": { id: "1037", name: "Case" },
          "1039": { id: "1039", name: "Change purse" },
          "1040": { id: "1040", name: "Diaper bag" },
          "1041": { id: "1041", name: "Other" }
        }
      },
      "108": {
        id: "108",
        name: "Electronics",
        subcategories: {
          "1053": { id: "1053", name: "Camera" },
          "1054": { id: "1054", name: "Clock" },
          "1055": { id: "1055", name: "Radio" },
          "1056": { id: "1056", name: "Telephone" },
          "1057": { id: "1057", name: "Video game" },
          "1058": { id: "1058", name: "Television" },
          "1059": { id: "1059", name: "Game" },
          "1060": { id: "1060", name: "Other" }
        }
      },
      "109": {
        id: "109",
        name: "Furniture",
        subcategories: {
          "1061": { id: "1061", name: "Shelf" },
          "1062": { id: "1062", name: "Table" },
          "1063": { id: "1063", name: "Fixture" },
          "1064": { id: "1064", name: "Chair" },
          "1065": { id: "1065", name: "Mirror" },
          "1066": { id: "1066", name: "Storage" },
          "1067": { id: "1067", name: "Bench" },
          "1068": { id: "1068", name: "Dresser" },
          "1069": { id: "1069", name: "Bookcase" },
          "1070": { id: "1070", name: "Bed" },
          "1071": { id: "1071", name: "Desk" },
          "1072": { id: "1072", name: "Entertainment" },
          "1073": { id: "1073", name: "Other" }
        }
      },
      "111": { id: "111", name: "Other" },
      "2603": {
        id: "2603",
        name: "Collectible Coins",
        subcategories: {
          "2604": { id: "2604", name: "Collectible Ancient Coins" },
          "2605": { id: "2605", name: "Collectible Exonumia" },
          "2606": { id: "2606", name: "Collectible US Coins" },
          "2607": { id: "2607", name: "Collectible World Coins" },
          "2608": { id: "2608", name: "Other Collectible Coins" }
        }
      },
      "2609": {
        id: "2609",
        name: "Collectible Paper Money",
        subcategories: {
          "2610": { id: "2610", name: "Collectible US Paper Money" },
          "2611": { id: "2611", name: "Collectible World Paper Money" },
          "2612": { id: "2612", name: "Other Collectible Paper Money" }
        }
      },
      "2613": {
        id: "2613",
        name: "Collectible Postage",
        subcategories: {
          "2614": { id: "2614", name: "Collectible Airmail Stamps" },
          "2615": { id: "2615", name: "Collectible Cinderella Stamps" },
          "2616": { id: "2616", name: "Collectible Commemorative Stamps" },
          "2617": { id: "2617", name: "Collectible Definitive Stamps" },
          "2618": { id: "2618", name: "Collectible Postmarks" },
          "2619": { id: "2619", name: "Collectible Stamp Sheets" },
          "2620": { id: "2620", name: "Collectible Topical Stamps" },
          "2621": { id: "2621", name: "Other Collectible Stamps" }
        }
      }
    }
  },
  "8": {
    id: "8",
    name: "Sports & outdoors",
    subcategories: {
      "72": {
        id: "72",
        name: "Team sports",
        subcategories: {
          "703": { id: "703", name: "Soccer" },
          "704": { id: "704", name: "Lacrosse" },
          "706": { id: "706", name: "Hockey" },
          "707": { id: "707", name: "Football" },
          "708": { id: "708", name: "Tennis & racquets" },
          "709": { id: "709", name: "Badminton" },
          "710": { id: "710", name: "Volleyball" },
          "711": { id: "711", name: "Rugby" },
          "712": { id: "712", name: "All other sports" },
          "2127": { id: "2127", name: "Softball Equipment" }
        }
      },
      "73": {
        id: "73",
        name: "Exercise",
        subcategories: {
          "713": { id: "713", name: "Strength training" },
          "714": { id: "714", name: "Fitness accessories" },
          "715": { id: "715", name: "Boxing & mma" },
          "716": { id: "716", name: "Fitness technology" },
          "717": { id: "717", name: "Athletic training" },
          "719": { id: "719", name: "Bowling" },
          "720": { id: "720", name: "Dance/ballet" },
          "721": { id: "721", name: "Track & field" },
          "722": { id: "722", name: "Other" },
          "2128": { id: "2128", name: "Pilates Equipment" },
          "2539": { id: "2539", name: "Ballet Shoes" },
          "2540": { id: "2540", name: "Dance Leotards" },
          "2541": { id: "2541", name: "Tap Shoes" }
        }
      },
      "74": {
        id: "74",
        name: "Footwear",
        subcategories: {
          "723": { id: "723", name: "Cleats" },
          "724": { id: "724", name: "Men" },
          "725": { id: "725", name: "Women" },
          "726": { id: "726", name: "Kids" },
          "727": { id: "727", name: "Other" }
        }
      },
      "75": {
        id: "75",
        name: "Apparel",
        subcategories: {
          "728": { id: "728", name: "Men" },
          "729": { id: "729", name: "Women" },
          "730": { id: "730", name: "Boys" },
          "731": { id: "731", name: "Girls" },
          "732": { id: "732", name: "Accessories" },
          "733": { id: "733", name: "Other" }
        }
      },
      "76": {
        id: "76",
        name: "Golf",
        subcategories: {
          "734": { id: "734", name: "Men's golf clubs" },
          "735": { id: "735", name: "Women's golf clubs" },
          "736": { id: "736", name: "Golf apparel" },
          "737": { id: "737", name: "Golf shoes" },
          "738": { id: "738", name: "Golf bags" },
          "739": { id: "739", name: "Golf balls" },
          "740": { id: "740", name: "Electronics" },
          "741": { id: "741", name: "Other" }
        }
      },
      "77": {
        id: "77",
        name: "Outdoors",
        subcategories: {
          "745": { id: "745", name: "Water sports" },
          "746": { id: "746", name: "Indoor/outdoor games" },
          "747": { id: "747", name: "Boating" },
          "751": { id: "751", name: "Other" },
          "2130": { id: "2130", name: "Biking Equipment" },
          "2131": { id: "2131", name: "Skating Equipment" },
          "2133": { id: "2133", name: "Hiking Equipment" },
          "3156": { id: "3156", name: "Electric Scooters" }
        }
      },
      "78": {
        id: "78",
        name: "Fan shop",
        subcategories: {
          "752": { id: "752", name: "MLB" },
          "753": { id: "753", name: "NFL" },
          "754": { id: "754", name: "NHL" },
          "755": { id: "755", name: "NBA" },
          "756": { id: "756", name: "NCAA" },
          "757": { id: "757", name: "Other" }
        }
      },
      "79": { id: "79", name: "Other" },
      "705": {
        id: "705",
        name: "Basketball Equipment",
        subcategories: {
          "3114": { id: "3114", name: "Basketball Accessories" },
          "3115": { id: "3115", name: "Basketball Headbands" },
          "3116": { id: "3116", name: "Basketball Hoops" },
          "3117": { id: "3117", name: "Basketball Protective Gear" },
          "3118": { id: "3118", name: "Basketball Shirts & Jerseys" },
          "3119": { id: "3119", name: "Basketball Sleeves" },
          "3120": { id: "3120", name: "Basketball Socks" },
          "3121": { id: "3121", name: "Basketball Training Equipment" },
          "3122": { id: "3122", name: "Basketballs" },
          "3123": { id: "3123", name: "Other Basketball Equipment" }
        }
      },
      "744": {
        id: "744",
        name: "Fishing Gear",
        subcategories: {
          "2542": { id: "2542", name: "Fishing Apparel" },
          "2543": { id: "2543", name: "Fishing Bait Buckets" },
          "2544": { id: "2544", name: "Fishing Floats" },
          "2545": { id: "2545", name: "Fishing Hooks" },
          "2546": { id: "2546", name: "Fishing Jig Heads" },
          "2547": { id: "2547", name: "Fishing Line" },
          "2548": { id: "2548", name: "Fishing Lures" },
          "2549": { id: "2549", name: "Fishing Nets" },
          "2550": { id: "2550", name: "Fishing Reels" },
          "2551": { id: "2551", name: "Fishing Rod & Reel Combos" },
          "2552": { id: "2552", name: "Fishing Rod Holders" },
          "2553": { id: "2553", name: "Fishing Rod Racks" },
          "2554": { id: "2554", name: "Fishing Rods" },
          "2555": { id: "2555", name: "Fishing Sinkers" },
          "2556": { id: "2556", name: "Fishing Tackle Bags" },
          "2557": { id: "2557", name: "Fishing Tackle Boxes" },
          "2558": { id: "2558", name: "Fishing Weights" },
          "2559": { id: "2559", name: "Fly Fishing Flies" }
        }
      },
      "749": {
        id: "749",
        name: "Snowboarding Gear",
        subcategories: {
          "2588": { id: "2588", name: "Snowboard Accessories" },
          "2589": { id: "2589", name: "Snowboard Bags" },
          "2590": { id: "2590", name: "Snowboard Bindings" },
          "2591": { id: "2591", name: "Snowboard Boots" },
          "2592": { id: "2592", name: "Snowboard Gloves" },
          "2593": { id: "2593", name: "Snowboard Goggles" },
          "2594": { id: "2594", name: "Snowboard Helmets" },
          "2595": { id: "2595", name: "Snowboards" }
        }
      },
      "750": {
        id: "750",
        name: "Skateboard Gear",
        subcategories: {
          "2560": { id: "2560", name: "Complete Skateboards" },
          "2561": { id: "2561", name: "Skateboard Bearings" },
          "2562": { id: "2562", name: "Skateboard Bushings" },
          "2563": { id: "2563", name: "Skateboard Decks" },
          "2564": { id: "2564", name: "Skateboard Griptape" },
          "2565": { id: "2565", name: "Skateboard Hardware" },
          "2566": { id: "2566", name: "Skateboard Helmets" },
          "2567": { id: "2567", name: "Skateboard Pads" },
          "2568": { id: "2568", name: "Skateboard Risers" },
          "2569": { id: "2569", name: "Skateboard Trucks" },
          "2570": { id: "2570", name: "Skateboard Wheels" },
          "3157": { id: "3157", name: "Electric Skateboards" }
        }
      },
      "2126": {
        id: "2126",
        name: "Baseball Equipment",
        subcategories: {
          "3092": { id: "3092", name: "Base Sets & Homeplates" },
          "3093": { id: "3093", name: "Baseball Accessories" },
          "3094": { id: "3094", name: "Baseball Bat Racks" },
          "3095": { id: "3095", name: "Baseball Bats" },
          "3096": { id: "3096", name: "Baseball Belts" },
          "3097": { id: "3097", name: "Baseball Cleats" },
          "3098": { id: "3098", name: "Baseball Equipment Bags" },
          "3099": { id: "3099", name: "Baseball Face Guards" },
          "3100": { id: "3100", name: "Baseball Gloves & Mitts" },
          "3101": { id: "3101", name: "Baseball Helmets" },
          "3102": { id: "3102", name: "Baseball Jackets" },
          "3103": { id: "3103", name: "Baseball Pants" },
          "3104": { id: "3104", name: "Baseball Protective Gear" },
          "3105": { id: "3105", name: "Baseball Shirts & Jerseys" },
          "3106": { id: "3106", name: "Baseball Socks" },
          "3107": { id: "3107", name: "Baseball Uniforms" },
          "3108": { id: "3108", name: "Baseballs" },
          "3109": { id: "3109", name: "Batting Cages & Netting" },
          "3110": { id: "3110", name: "Batting Gloves" },
          "3111": { id: "3111", name: "Batting Tees" },
          "3112": { id: "3112", name: "Pitching Machines" },
          "3113": { id: "3113", name: "Other Baseball Equipment" }
        }
      },
      "2129": {
        id: "2129",
        name: "Yoga Equipment",
        subcategories: {
          "3158": { id: "3158", name: "Yoga Blankets" },
          "3159": { id: "3159", name: "Yoga Blocks" },
          "3160": { id: "3160", name: "Yoga Bolsters & Cushions" },
          "3161": { id: "3161", name: "Yoga Mat Bags" },
          "3162": { id: "3162", name: "Yoga Mat Cleaners" },
          "3163": { id: "3163", name: "Yoga Mats" },
          "3164": { id: "3164", name: "Yoga Sandbags" },
          "3165": { id: "3165", name: "Yoga Straps" },
          "3166": { id: "3166", name: "Yoga Wheels" },
          "3167": { id: "3167", name: "Other Yoga Equipment" }
        }
      },
      "2132": {
        id: "2132",
        name: "Camping Equipment",
        subcategories: {
          "3124": { id: "3124", name: "Camping Canopies" },
          "3125": { id: "3125", name: "Camping Chairs" },
          "3126": { id: "3126", name: "Camping Coolers & Ice Chests" },
          "3127": { id: "3127", name: "Camping Tables" },
          "3128": { id: "3128", name: "Camping Tents" },
          "3129": { id: "3129", name: "Inflatable Beds" },
          "3130": { id: "3130", name: "Insect Repellant Candles" },
          "3131": { id: "3131", name: "Insect Repellant Sprays" },
          "3132": { id: "3132", name: "Insect Repellant Torches" },
          "3133": { id: "3133", name: "Outdoor Flashlights" },
          "3134": { id: "3134", name: "Outdoor Headlamps" },
          "3135": { id: "3135", name: "Camping Lanterns" },
          "3136": { id: "3136", name: "Portable Grills" },
          "3137": { id: "3137", name: "Sleeping Bags" },
          "3138": { id: "3138", name: "Camping Sleeping Pads" },
          "3139": { id: "3139", name: "Camping Tools" },
          "3140": { id: "3140", name: "Other Camping Equipment" }
        }
      },
      "2571": {
        id: "2571",
        name: "Ski Gear",
        subcategories: {
          "2572": { id: "2572", name: "Ski Body Armor" },
          "2573": { id: "2573", name: "Cross Country Skis" },
          "2574": { id: "2574", name: "Downhill Skis" },
          "2575": { id: "2575", name: "Ski Bags" },
          "2576": { id: "2576", name: "Ski Bindings" },
          "2577": { id: "2577", name: "Ski Boots" },
          "2578": { id: "2578", name: "Ski Face Masks" },
          "2579": { id: "2579", name: "Ski Gloves" },
          "2580": { id: "2580", name: "Ski Goggles" },
          "2581": { id: "2581", name: "Ski Hats" },
          "2582": { id: "2582", name: "Ski Helmets" },
          "2583": { id: "2583", name: "Ski Mittens" },
          "2584": { id: "2584", name: "Ski Poles" },
          "2585": { id: "2585", name: "Ski Racks" },
          "2586": { id: "2586", name: "Ski Socks" },
          "2587": { id: "2587", name: "Ski Tuning Tools" }
        }
      },
      "3141": {
        id: "3141",
        name: "Cycling Equipment",
        subcategories: {
          "3142": { id: "3142", name: "Complete BMX Bikes" },
          "3143": { id: "3143", name: "Complete Mountain Bikes" },
          "3144": { id: "3144", name: "Complete Road Bikes" },
          "3145": { id: "3145", name: "Complete Cyclocross Bikes" },
          "3146": { id: "3146", name: "Complete Gravel Bikes" },
          "3147": { id: "3147", name: "Complete Triathlon Bikes" },
          "3148": { id: "3148", name: "Mountain Bike Frames" },
          "3149": { id: "3149", name: "Mountain Bike Handle Bars" },
          "3150": { id: "3150", name: "Mountain Bike Drivetrains" },
          "3151": { id: "3151", name: "Mountain Bike Wheels" },
          "3152": { id: "3152", name: "Road Bike Frames" },
          "3153": { id: "3153", name: "Cyclocross Bike Frames" },
          "3154": { id: "3154", name: "Gravel Bike Frames" },
          "3155": { id: "3155", name: "Triathlon Bike Frames" }
        }
      }
    }
  },
  "9": {
    id: "9",
    name: "Handmade",
    subcategories: {
      "112": {
        id: "112",
        name: "Housewares",
        subcategories: {
          "1084": { id: "1084", name: "Home decor" },
          "1085": { id: "1085", name: "Pillows" },
          "1086": { id: "1086", name: "Wall decor" },
          "1087": { id: "1087", name: "Lighting" },
          "1088": { id: "1088", name: "Kitchen" },
          "1089": { id: "1089", name: "Entertaining/serving" },
          "1090": { id: "1090", name: "Bedroom" },
          "1091": { id: "1091", name: "Frames" },
          "1092": { id: "1092", name: "Clocks" },
          "1093": { id: "1093", name: "Magnets" },
          "1094": { id: "1094", name: "Rugs" },
          "1095": { id: "1095", name: "Bathroom" },
          "1096": { id: "1096", name: "Outdoor" },
          "1097": { id: "1097", name: "Office" },
          "1098": { id: "1098", name: "Storage solutions" },
          "1099": { id: "1099", name: "Cleaning" },
          "1100": { id: "1100", name: "Other" }
        }
      },
      "114": {
        id: "114",
        name: "Woodworking",
        subcategories: {
          "1113": { id: "1113", name: "Home decor" },
          "1114": { id: "1114", name: "Signs" },
          "1115": { id: "1115", name: "Boxes" },
          "1116": { id: "1116", name: "Fretwork" },
          "1117": { id: "1117", name: "Burning" },
          "1118": { id: "1118", name: "Sculptures" },
          "1119": { id: "1119", name: "Kitchen" },
          "1120": { id: "1120", name: "Carving" },
          "1121": { id: "1121", name: "Outdoor" },
          "1122": { id: "1122", name: "Clocks" },
          "1123": { id: "1123", name: "Seasonal" },
          "1124": { id: "1124", name: "Toys" },
          "1125": { id: "1125", name: "Supplies" },
          "1126": { id: "1126", name: "Accessories" },
          "1127": { id: "1127", name: "Jewelry" },
          "1128": { id: "1128", name: "Office" },
          "1129": { id: "1129", name: "Sports" },
          "1130": { id: "1130", name: "Miniature" },
          "1131": { id: "1131", name: "Inlay" },
          "1132": { id: "1132", name: "Other" }
        }
      },
      "115": {
        id: "115",
        name: "Ceramics and pottery",
        subcategories: {
          "1133": { id: "1133", name: "Home decor" },
          "1134": { id: "1134", name: "Vases" },
          "1135": { id: "1135", name: "Bowls" },
          "1136": { id: "1136", name: "Tiles" },
          "1137": { id: "1137", name: "Sculptures" },
          "1138": { id: "1138", name: "Planters" },
          "1139": { id: "1139", name: "Kitchen" },
          "1140": { id: "1140", name: "Jars" },
          "1141": { id: "1141", name: "Coasters" },
          "1142": { id: "1142", name: "Miniature" },
          "1143": { id: "1143", name: "Soap dish" },
          "1144": { id: "1144", name: "Teapots" },
          "1145": { id: "1145", name: "Jewelry" },
          "1146": { id: "1146", name: "Supplies" },
          "1147": { id: "1147", name: "Other" }
        }
      },
      "116": {
        id: "116",
        name: "Glass",
        subcategories: {
          "1148": { id: "1148", name: "Home decor" },
          "1149": { id: "1149", name: "Stained glass" },
          "1150": { id: "1150", name: "Glassware" },
          "1151": { id: "1151", name: "Vases" },
          "1152": { id: "1152", name: "Bottles" },
          "1153": { id: "1153", name: "Dishes" },
          "1154": { id: "1154", name: "Bowls" },
          "1155": { id: "1155", name: "Paperweights" },
          "1156": { id: "1156", name: "Sculptures" },
          "1157": { id: "1157", name: "Ornaments" },
          "1158": { id: "1158", name: "Windchimes" },
          "1159": { id: "1159", name: "Mirrors" },
          "1160": { id: "1160", name: "Beads" },
          "1161": { id: "1161", name: "Supplies" },
          "1162": { id: "1162", name: "Jewelry" },
          "1163": { id: "1163", name: "Marbles" },
          "1164": { id: "1164", name: "Other" }
        }
      },
      "118": {
        id: "118",
        name: "Weddings",
        subcategories: {
          "1172": { id: "1172", name: "Decorations" },
          "1173": { id: "1173", name: "Favors" },
          "1174": { id: "1174", name: "Cake toppers" },
          "1175": { id: "1175", name: "Frames" },
          "1176": { id: "1176", name: "Accessories" },
          "1177": { id: "1177", name: "Bouquets" },
          "1178": { id: "1178", name: "Just married" },
          "1179": { id: "1179", name: "Candles" },
          "1180": { id: "1180", name: "Guest books" },
          "1181": { id: "1181", name: "Pillows" },
          "1182": { id: "1182", name: "Invitations" },
          "1183": { id: "1183", name: "Albums" },
          "1184": { id: "1184", name: "Cards" },
          "1185": { id: "1185", name: "Something blue" },
          "1186": { id: "1186", name: "Portraits" },
          "1187": { id: "1187", name: "Men" },
          "1188": { id: "1188", name: "Jewelry" },
          "1189": { id: "1189", name: "Bags and purses" },
          "1190": { id: "1190", name: "Clothing" },
          "1191": { id: "1191", name: "Other" }
        }
      },
      "119": {
        id: "119",
        name: "Holidays",
        subcategories: {
          "1192": { id: "1192", name: "Christmas" },
          "1193": { id: "1193", name: "Easter" },
          "1194": { id: "1194", name: "Halloween" },
          "1195": { id: "1195", name: "Valentine" },
          "1196": { id: "1196", name: "Patriotic" },
          "1197": { id: "1197", name: "Thanksgiving" },
          "1198": { id: "1198", name: "Birthday" },
          "1199": { id: "1199", name: "St Patricks" },
          "1200": { id: "1200", name: "Hanukkah" },
          "1201": { id: "1201", name: "Day of the dead" },
          "1202": { id: "1202", name: "New years" },
          "1203": { id: "1203", name: "Other" }
        }
      },
      "121": {
        id: "121",
        name: "Children",
        subcategories: {
          "1222": { id: "1222", name: "Housewares" },
          "1223": { id: "1223", name: "Art" },
          "1224": { id: "1224", name: "Baby" },
          "1225": { id: "1225", name: "Toy" },
          "1226": { id: "1226", name: "Accessories" },
          "1227": { id: "1227", name: "Furniture" },
          "1228": { id: "1228", name: "Toddler" },
          "1229": { id: "1229", name: "Clothing" },
          "1230": { id: "1230", name: "Bath" },
          "1231": { id: "1231", name: "Jewelry" },
          "1232": { id: "1232", name: "Other" }
        }
      },
      "122": {
        id: "122",
        name: "Needlecraft",
        subcategories: {
          "1233": { id: "1233", name: "Embroidery" },
          "1234": { id: "1234", name: "Pillow" },
          "1235": { id: "1235", name: "Cross stitch" },
          "1236": { id: "1236", name: "Needlepoint" },
          "1237": { id: "1237", name: "Felted" },
          "1238": { id: "1238", name: "Pincushion" },
          "1239": { id: "1239", name: "Pattern" },
          "1240": { id: "1240", name: "Holidays" },
          "1241": { id: "1241", name: "Accessories" },
          "1242": { id: "1242", name: "Doll" },
          "1243": { id: "1243", name: "Supplies" },
          "1244": { id: "1244", name: "Clothing" },
          "1245": { id: "1245", name: "Other" }
        }
      },
      "123": {
        id: "123",
        name: "Geekery",
        subcategories: {
          "1246": { id: "1246", name: "Housewares" },
          "1247": { id: "1247", name: "Humor" },
          "1248": { id: "1248", name: "Kitsch" },
          "1249": { id: "1249", name: "Science" },
          "1250": { id: "1250", name: "Electronic" },
          "1251": { id: "1251", name: "Accessory" },
          "1252": { id: "1252", name: "Computer" },
          "1253": { id: "1253", name: "Gadget" },
          "1254": { id: "1254", name: "Videogame" },
          "1255": { id: "1255", name: "Fantasy" },
          "1256": { id: "1256", name: "Robot" },
          "1257": { id: "1257", name: "Horror" },
          "1259": { id: "1259", name: "Magic" },
          "1260": { id: "1260", name: "Toy" },
          "1261": { id: "1261", name: "Jewelry" },
          "1262": { id: "1262", name: "Other" }
        }
      },
      "124": {
        id: "124",
        name: "Paper goods",
        subcategories: {
          "1263": { id: "1263", name: "Sticker" },
          "1264": { id: "1264", name: "Cards" },
          "1265": { id: "1265", name: "Origami" },
          "1266": { id: "1266", name: "Scrapbooking" },
          "1267": { id: "1267", name: "Papermaking" },
          "1268": { id: "1268", name: "Stationery" },
          "1269": { id: "1269", name: "Tag" },
          "1270": { id: "1270", name: "Calendar" },
          "1271": { id: "1271", name: "Gift wrap" },
          "1272": { id: "1272", name: "Journal" },
          "1273": { id: "1273", name: "Notebook" },
          "1274": { id: "1274", name: "Bookplate" },
          "1275": { id: "1275", name: "Pad" },
          "1276": { id: "1276", name: "Bookmark" },
          "1277": { id: "1277", name: "Other" }
        }
      },
      "125": { id: "125", name: "Candles" },
      "126": {
        id: "126",
        name: "Patterns",
        subcategories: {
          "1293": { id: "1293", name: "Crochet" },
          "1294": { id: "1294", name: "Beading" },
          "1295": { id: "1295", name: "Cross stitch" },
          "1297": { id: "1297", name: "Embroidery" },
          "1298": { id: "1298", name: "Sewing" },
          "1299": { id: "1299", name: "Home" },
          "1300": { id: "1300", name: "Quilt" },
          "1301": { id: "1301", name: "Holiday" },
          "1302": { id: "1302", name: "Painting" },
          "1303": { id: "1303", name: "Knitting" },
          "1304": { id: "1304", name: "Amigurumi" },
          "1305": { id: "1305", name: "Plushie" },
          "1306": { id: "1306", name: "Accessories" },
          "1307": { id: "1307", name: "Baby" },
          "1308": { id: "1308", name: "Clothing" },
          "1309": { id: "1309", name: "Doll clothing" },
          "1310": { id: "1310", name: "Other" }
        }
      },
      "127": {
        id: "127",
        name: "Crochet",
        subcategories: {
          "1311": { id: "1311", name: "Housewares" },
          "1312": { id: "1312", name: "Afghan" },
          "1313": { id: "1313", name: "Supplies" },
          "1314": { id: "1314", name: "Accessories" },
          "1315": { id: "1315", name: "Doll" },
          "1316": { id: "1316", name: "Hat" },
          "1317": { id: "1317", name: "Bags and purses" },
          "1318": { id: "1318", name: "Scarf" },
          "1319": { id: "1319", name: "Clothing" },
          "1320": { id: "1320", name: "Jewelry" },
          "1321": { id: "1321", name: "Other" }
        }
      },
      "128": {
        id: "128",
        name: "Furniture",
        subcategories: {
          "1322": { id: "1322", name: "Shelf" },
          "1323": { id: "1323", name: "Table" },
          "1324": { id: "1324", name: "Fixture" },
          "1325": { id: "1325", name: "Chair" },
          "1326": { id: "1326", name: "Mirror" },
          "1327": { id: "1327", name: "Storage" },
          "1328": { id: "1328", name: "Bench" },
          "1329": { id: "1329", name: "Dresser" },
          "1330": { id: "1330", name: "Bookcase" },
          "1331": { id: "1331", name: "Bed" },
          "1332": { id: "1332", name: "Desk" },
          "1333": { id: "1333", name: "Entertainment" },
          "1334": { id: "1334", name: "Other" }
        }
      },
      "129": {
        id: "129",
        name: "Quilts",
        subcategories: {
          "1335": { id: "1335", name: "Table runner" },
          "1336": { id: "1336", name: "Wall hanging" },
          "1337": { id: "1337", name: "Bed" },
          "1338": { id: "1338", name: "Patchwork" },
          "1339": { id: "1339", name: "Pillow" },
          "1340": { id: "1340", name: "Traditional" },
          "1341": { id: "1341", name: "Mini" },
          "1342": { id: "1342", name: "Baby" },
          "1343": { id: "1343", name: "Applique" },
          "1344": { id: "1344", name: "Geometric" },
          "1345": { id: "1345", name: "Rag" },
          "1346": { id: "1346", name: "Fabric postcard" },
          "1347": { id: "1347", name: "Patch" },
          "1349": { id: "1349", name: "Trim" },
          "1350": { id: "1350", name: "Other" }
        }
      },
      "130": {
        id: "130",
        name: "Accessories",
        subcategories: {
          "1351": { id: "1351", name: "Women" },
          "1352": { id: "1352", name: "Apron" },
          "1353": { id: "1353", name: "Case" },
          "1354": { id: "1354", name: "Keychain" },
          "1355": { id: "1355", name: "Mirror" },
          "1356": { id: "1356", name: "Cozy" },
          "1357": { id: "1357", name: "Patch" },
          "1358": { id: "1358", name: "Pin" },
          "1359": { id: "1359", name: "Scarf" },
          "1360": { id: "1360", name: "Charm" },
          "1361": { id: "1361", name: "Hair" },
          "1362": { id: "1362", name: "Shawl" },
          "1363": { id: "1363", name: "Men" },
          "1364": { id: "1364", name: "Leg warmers" },
          "1365": { id: "1365", name: "Eyewear" },
          "1366": { id: "1366", name: "Pinback button" },
          "1367": { id: "1367", name: "Hat" },
          "1368": { id: "1368", name: "Belt" },
          "1369": { id: "1369", name: "Gloves" },
          "1370": { id: "1370", name: "Cuff" },
          "1371": { id: "1371", name: "Wallet" },
          "1372": { id: "1372", name: "Lanyard" },
          "1373": { id: "1373", name: "Watch" },
          "1374": { id: "1374", name: "Necktie" },
          "1375": { id: "1375", name: "Other" }
        }
      },
      "131": {
        id: "131",
        name: "Pets",
        subcategories: {
          "1376": { id: "1376", name: "Pet lover" },
          "1377": { id: "1377", name: "Bed" },
          "1378": { id: "1378", name: "Portrait" },
          "1379": { id: "1379", name: "Bowl" },
          "1380": { id: "1380", name: "Feeding" },
          "1381": { id: "1381", name: "House" },
          "1382": { id: "1382", name: "Accessories" },
          "1383": { id: "1383", name: "Pillow" },
          "1384": { id: "1384", name: "Blanket" },
          "1385": { id: "1385", name: "Small animal" },
          "1386": { id: "1386", name: "Toy" },
          "1387": { id: "1387", name: "Grooming" },
          "1388": { id: "1388", name: "Collar" },
          "1389": { id: "1389", name: "Leash" },
          "1391": { id: "1391", name: "Clothing" },
          "1392": { id: "1392", name: "Tag" },
          "1393": { id: "1393", name: "Other" }
        }
      },
      "134": {
        id: "134",
        name: "Knitting",
        subcategories: {
          "1419": { id: "1419", name: "Housewares" },
          "1420": { id: "1420", name: "Blanket" },
          "1421": { id: "1421", name: "Knitting supplies" },
          "1422": { id: "1422", name: "Cozy" },
          "1423": { id: "1423", name: "Accessories" },
          "1424": { id: "1424", name: "Sweater" },
          "1425": { id: "1425", name: "Children" },
          "1426": { id: "1426", name: "Doll" },
          "1427": { id: "1427", name: "Clothing" },
          "1428": { id: "1428", name: "Baby" },
          "1429": { id: "1429", name: "Bags and purses" },
          "1430": { id: "1430", name: "Hat" },
          "1431": { id: "1431", name: "Women" },
          "1432": { id: "1432", name: "Men" },
          "1433": { id: "1433", name: "Scarf" },
          "1434": { id: "1434", name: "Other" }
        }
      },
      "135": {
        id: "135",
        name: "Bags and purses",
        subcategories: {
          "1435": { id: "1435", name: "Tote" },
          "1436": { id: "1436", name: "Purse" },
          "1437": { id: "1437", name: "Pouch" },
          "1438": { id: "1438", name: "Novelty" },
          "1439": { id: "1439", name: "Messenger" },
          "1440": { id: "1440", name: "Wristlet" },
          "1441": { id: "1441", name: "Clutch" },
          "1443": { id: "1443", name: "Diaper bag" },
          "1444": { id: "1444", name: "Laptop" },
          "1445": { id: "1445", name: "Backpack" },
          "1446": { id: "1446", name: "Hip bag" },
          "1447": { id: "1447", name: "Other" }
        }
      },
      "136": {
        id: "136",
        name: "Jewelry",
        subcategories: {
          "1449": { id: "1449", name: "Books and zines" },
          "1452": { id: "1452", name: "Other" }
        }
      },
      "137": {
        id: "137",
        name: "Books and zines",
        subcategories: {
          "1453": { id: "1453", name: "Book" },
          "1456": { id: "1456", name: "Album" },
          "1457": { id: "1457", name: "Zine" },
          "1458": { id: "1458", name: "Comic" },
          "1459": { id: "1459", name: "Other" }
        }
      },
      "138": {
        id: "138",
        name: "Clothing",
        subcategories: {
          "1460": { id: "1460", name: "Shoes" },
          "1461": { id: "1461", name: "Tshirt" },
          "1462": { id: "1462", name: "Women" },
          "1463": { id: "1463", name: "Costume" },
          "1464": { id: "1464", name: "Children" },
          "1465": { id: "1465", name: "Shirt" },
          "1467": { id: "1467", name: "Men" },
          "1468": { id: "1468", name: "Lingerie" },
          "1469": { id: "1469", name: "Dress" },
          "1470": { id: "1470", name: "Corset" },
          "1471": { id: "1471", name: "Other" }
        }
      },
      "139": {
        id: "139",
        name: "Music",
        subcategories: {
          "1472": { id: "1472", name: "Vinyl" },
          "1473": { id: "1473", name: "Poster" },
          "1474": { id: "1474", name: "Instrument" },
          "1475": { id: "1475", name: "Equipment" },
          "1476": { id: "1476", name: "Case" },
          "1477": { id: "1477", name: "Tape" },
          "1478": { id: "1478", name: "Other" }
        }
      },
      "140": { id: "140", name: "Other" }
    }
  },
  "113": {
    id: "113",
    name: "Arts & Crafts",
    subcategories: {
      "1101": { id: "1101", name: "Photography" },
      "1103": { id: "1103", name: "Handmade Paintings" },
      "1104": { id: "1104", name: "Mixed media" },
      "1105": { id: "1105", name: "Sculptures" },
      "1106": { id: "1106", name: "Illustration" },
      "1107": { id: "1107", name: "Collages" },
      "1108": { id: "1108", name: "Drawing Supplies" },
      "1109": { id: "1109", name: "Fiber art" },
      "1110": { id: "1110", name: "Printmaking" },
      "1111": { id: "1111", name: "Aceo" },
      "1112": { id: "1112", name: "Other Arts & Crafts" },
      "1726": {
        id: "1726",
        name: "Paint",
        subcategories: {
          "3414": { id: "3414", name: "Acrylic Paint" },
          "3415": { id: "3415", name: "Craft Paint" },
          "3416": { id: "3416", name: "Gouache" },
          "3417": { id: "3417", name: "Oil Paint" },
          "3418": { id: "3418", name: "Spray Paint" },
          "3419": { id: "3419", name: "Watercolor Paint" },
          "3420": { id: "3420", name: "Other Paint" }
        }
      },
      "2630": { id: "2630", name: "Native American Arts & Crafts" },
      "3371": {
        id: "3371",
        name: "Art Paper & Surfaces",
        subcategories: {
          "3372": { id: "3372", name: "Acrylic Painting Paper" },
          "3373": { id: "3373", name: "Artist Tiles" },
          "3374": { id: "3374", name: "Canvas Pads" },
          "3375": { id: "3375", name: "Canvas Rolls" },
          "3376": { id: "3376", name: "Charcoal Paper" },
          "3377": { id: "3377", name: "Colored Pencil Paper" },
          "3378": { id: "3378", name: "Foam Boards" },
          "3379": { id: "3379", name: "Illustration Boards" },
          "3380": { id: "3380", name: "Ink & Marker Paper" },
          "3381": { id: "3381", name: "Newsprint Paper" },
          "3382": { id: "3382", name: "Oil Painting Paper" },
          "3383": { id: "3383", name: "Oil Pastel Paper" },
          "3384": { id: "3384", name: "Paint Canvas" },
          "3385": { id: "3385", name: "Paper Rolls" },
          "3387": { id: "3387", name: "Poster Boards" },
          "3388": { id: "3388", name: "Printmaking Paper" },
          "3389": { id: "3389", name: "Sketch Paper" },
          "3390": { id: "3390", name: "Soft Pastel Paper" },
          "3391": { id: "3391", name: "Tracing Pads" },
          "3392": { id: "3392", name: "Tracing Paper" },
          "3393": { id: "3393", name: "Watercolor Paper" },
          "3394": { id: "3394", name: "Other Art Paper & Surfaces" }
        }
      },
      "3395": {
        id: "3395",
        name: "Art Pencils",
        subcategories: {
          "3396": { id: "3396", name: "Colored Pencils" },
          "3397": { id: "3397", name: "Charcoal Pencils" },
          "3398": { id: "3398", name: "Charcoal Sticks" },
          "3399": { id: "3399", name: "Watercolor Pencils" },
          "3400": { id: "3400", name: "Other Art Pencils" }
        }
      },
      "3401": {
        id: "3401",
        name: "Art Studio Furniture",
        subcategories: {
          "3402": { id: "3402", name: "Drafting Tables" },
          "3403": { id: "3403", name: "Easels" },
          "3404": { id: "3404", name: "Studio Furniture" },
          "3405": { id: "3405", name: "Other Art Studio Furniture" }
        }
      },
      "3406": {
        id: "3406",
        name: "Ink & Calligraphy",
        subcategories: {
          "3407": { id: "3407", name: "Alcohol Ink" },
          "3408": { id: "3408", name: "Calligraphy Ink Sets" },
          "3409": { id: "3409", name: "Drawing & Calligraphy Ink" },
          "3410": { id: "3410", name: "India Ink" },
          "3411": { id: "3411", name: "Pigment Powders" },
          "3412": { id: "3412", name: "Sumi Ink" },
          "3413": { id: "3413", name: "Other Ink & Calligraphy" }
        }
      },
      "3421": {
        id: "3421",
        name: "Paint Accessories",
        subcategories: {
          "3422": { id: "3422", name: "Artist Palettes" },
          "3423": { id: "3423", name: "Brush Cleaners" },
          "3424": { id: "3424", name: "Color Wheels" },
          "3425": { id: "3425", name: "Paint Droppers" },
          "3426": { id: "3426", name: "Paint Nozzles" },
          "3427": { id: "3427", name: "Paint Sponges" },
          "3428": { id: "3428", name: "Paint Storage Containers" },
          "3429": { id: "3429", name: "Paint Syringes" },
          "3430": { id: "3430", name: "Palette Knives" },
          "3431": { id: "3431", name: "Spray Lacquers & Sealers" },
          "3432": { id: "3432", name: "Other Paint Accessories" }
        }
      },
      "3433": {
        id: "3433",
        name: "Paint Brushes",
        subcategories: {
          "3434": { id: "3434", name: "Acrylic Brushes" },
          "3435": { id: "3435", name: "Airbrushes" },
          "3436": { id: "3436", name: "Brush Sets" },
          "3437": { id: "3437", name: "Multi-Purpose Brushes" },
          "3438": { id: "3438", name: "Oil Brushes" },
          "3439": { id: "3439", name: "Specialty Brushes" },
          "3440": { id: "3440", name: "Watercolor Brushes" },
          "3441": { id: "3441", name: "Other Paint Brushes" }
        }
      },
      "3442": {
        id: "3442",
        name: "Pastels",
        subcategories: {
          "3443": { id: "3443", name: "Oil Pastels" },
          "3444": { id: "3444", name: "Pastel Pencils" },
          "3445": { id: "3445", name: "Soft Pastels" },
          "3446": { id: "3446", name: "Wax Pastels & Crayons" },
          "3447": { id: "3447", name: "Other Pastels" }
        }
      },
      "3448": {
        id: "3448",
        name: "Mediums & Varnishes",
        subcategories: {
          "3449": { id: "3449", name: "Acrylic Mediums" },
          "3450": { id: "3450", name: "Gessoes & Primers" },
          "3451": { id: "3451", name: "Masking Fluids & Frisket" },
          "3452": { id: "3452", name: "Oil Mediums" },
          "3453": { id: "3453", name: "Oil Painting Solvents" },
          "3454": { id: "3454", name: "Pouring Mediums" },
          "3455": { id: "3455", name: "Varnishes & Topcoats" },
          "3456": { id: "3456", name: "Watercolor Mediums" },
          "3457": { id: "3457", name: "Other Mediums & Varnishes" }
        }
      },
      "3458": {
        id: "3458",
        name: "Resin Art Supplies",
        subcategories: {
          "3459": { id: "3459", name: "Epoxy Resin" },
          "3460": { id: "3460", name: "Resin Fillers" },
          "3461": { id: "3461", name: "Resin Glitter" },
          "3462": { id: "3462", name: "Resin Molds" },
          "3463": { id: "3463", name: "Resin Pigments" },
          "3464": { id: "3464", name: "Other Resin Art" }
        }
      },
      "3465": {
        id: "3465",
        name: "Stamping & Embossing",
        subcategories: {
          "3466": { id: "3466", name: "Cling Stamps" },
          "3467": { id: "3467", name: "Embossing Powders" },
          "3468": { id: "3468", name: "Rubber Stamps" },
          "3469": { id: "3469", name: "Sealing Wax" },
          "3470": { id: "3470", name: "Stamp Handles" },
          "3471": { id: "3471", name: "Stamp Ink Pads" },
          "3472": { id: "3472", name: "Stamp Ink Refills" },
          "3473": { id: "3473", name: "Stamp Mounts" },
          "3474": { id: "3474", name: "Stamping Collections" },
          "3475": { id: "3475", name: "Stamping Kits" },
          "3476": { id: "3476", name: "Wax Seal Stamps" },
          "3477": { id: "3477", name: "Other Stamping & Embossing" }
        }
      }
    }
  },
  "143": {
    id: "143",
    name: "Pet Supplies",
    subcategories: {
      "1508": { id: "1508", name: "Others" },
      "3008": {
        id: "3008",
        name: "Aquariums & Fish Supplies",
        subcategories: {
          "3009": { id: "3009", name: "Air Pumps" },
          "3010": { id: "3010", name: "Aquarium Decor" },
          "3011": { id: "3011", name: "Aquarium Heaters" },
          "3012": { id: "3012", name: "Aquarium Lighting" },
          "3013": { id: "3013", name: "Aquarium Water Cleaners" },
          "3014": { id: "3014", name: "Aquariums & Tanks" },
          "3015": { id: "3015", name: "Tank Filters" },
          "3016": { id: "3016", name: "Fish Bowls" },
          "3017": { id: "3017", name: "Fish Food" },
          "3018": { id: "3018", name: "Aquarium Gravel & Substrate" },
          "3019": { id: "3019", name: "Aquarium UV Sterilizers" },
          "3020": { id: "3020", name: "Aquarium Water Pumps" },
          "3021": { id: "3021", name: "Other Aquarium & Fish Supplies" }
        }
      },
      "3022": {
        id: "3022",
        name: "Bird Supplies",
        subcategories: {
          "3023": { id: "3023", name: "Bird Cage Covers" },
          "3024": { id: "3024", name: "Bird Cages" },
          "3025": { id: "3025", name: "Bird Feed" },
          "3026": { id: "3026", name: "Bird Litter" },
          "3027": { id: "3027", name: "Bird Perches" },
          "3028": { id: "3028", name: "Bird Swings" },
          "3029": { id: "3029", name: "Bird Toys" },
          "3030": { id: "3030", name: "Other Bird Supplies" }
        }
      },
      "3031": {
        id: "3031",
        name: "Cat Supplies",
        subcategories: {
          "3032": { id: "3032", name: "Cat Beds" },
          "3033": { id: "3033", name: "Cat Bowls & Feeders" },
          "3034": { id: "3034", name: "Cat Brushes" },
          "3035": { id: "3035", name: "Cat Carriers" },
          "3036": { id: "3036", name: "Cat Collars" },
          "3037": { id: "3037", name: "Cat Costumes" },
          "3038": { id: "3038", name: "Cat Crates" },
          "3039": { id: "3039", name: "Cat Doors & Flaps" },
          "3040": { id: "3040", name: "Cat Food" },
          "3041": { id: "3041", name: "Cat Grass" },
          "3042": { id: "3042", name: "Cat Harnesses" },
          "3043": { id: "3043", name: "Cat Leashes" },
          "3044": { id: "3044", name: "Cat Litter" },
          "3045": { id: "3045", name: "Cat Scratchers" },
          "3046": { id: "3046", name: "Cat Supplements" },
          "3047": { id: "3047", name: "Cat Tags" },
          "3048": { id: "3048", name: "Cat Toys" },
          "3049": { id: "3049", name: "Cat Treats" },
          "3050": { id: "3050", name: "Catnip" },
          "3051": { id: "3051", name: "Cat Flea & Tick Prevention" },
          "3052": { id: "3052", name: "Cat Litter Boxes" },
          "3053": { id: "3053", name: "Cat Pheromone Treatment" },
          "3054": { id: "3054", name: "Other Cat Supplies" }
        }
      },
      "3055": {
        id: "3055",
        name: "Dog Supplies",
        subcategories: {
          "1506": { id: "1506", name: "Dog Cages" },
          "3056": { id: "3056", name: "Dog Beds" },
          "3057": { id: "3057", name: "Dog Blankets" },
          "3058": { id: "3058", name: "Dog Bowls & Feeders" },
          "3059": { id: "3059", name: "Dog Brushes" },
          "3060": { id: "3060", name: "Dog Chews & Treats" },
          "3061": { id: "3061", name: "Dog Collars" },
          "3062": { id: "3062", name: "Dog Combs" },
          "3063": { id: "3063", name: "Dog Costumes" },
          "3064": { id: "3064", name: "Dog Crates" },
          "3065": { id: "3065", name: "Dog Doors & Flaps" },
          "3066": { id: "3066", name: "Dog Food" },
          "3067": { id: "3067", name: "Dog Fur Clippers" },
          "3068": { id: "3068", name: "Dog Gates & Pens" },
          "3069": { id: "3069", name: "Dog Harnesses" },
          "3070": { id: "3070", name: "Dog Houses" },
          "3071": { id: "3071", name: "Dog Leashes" },
          "3072": { id: "3072", name: "Dog Muzzles" },
          "3073": { id: "3073", name: "Dog Nail Trimmers" },
          "3074": { id: "3074", name: "Dog Pools" },
          "3075": { id: "3075", name: "Dog Shampoo" },
          "3076": { id: "3076", name: "Dog Shoes" },
          "3077": { id: "3077", name: "Dog Supplements" },
          "3078": { id: "3078", name: "Dog Tags" },
          "3079": { id: "3079", name: "Dog Toys" },
          "3080": { id: "3080", name: "Dog Waste Bags" },
          "3081": { id: "3081", name: "Dog Whistles" },
          "3082": { id: "3082", name: "Dog Flea & Tick Treatment" },
          "3083": { id: "3083", name: "Pet Odor & Stain Removal" },
          "3084": { id: "3084", name: "Pooper Scoopers" },
          "3085": { id: "3085", name: "Other Dog Supplies" }
        }
      },
      "3086": {
        id: "3086",
        name: "Reptile Supplies",
        subcategories: {
          "3087": { id: "3087", name: "Reptile Food" },
          "3088": { id: "3088", name: "Reptile Heaters" },
          "3089": { id: "3089", name: "Reptile Terrariums" },
          "3090": { id: "3090", name: "Terrerium Decor" },
          "3091": { id: "3091", name: "Other Reptile Supplies" }
        }
      }
    }
  },
  "2633": {
    id: "2633",
    name: "Garden & Outdoor",
    subcategories: {
      "2634": {
        id: "2634",
        name: "Garden Decor",
        subcategories: {
          "2635": { id: "2635", name: "Bird Feeders" },
          "2636": { id: "2636", name: "Birdbaths" },
          "2637": { id: "2637", name: "Birdhouses" },
          "2638": { id: "2638", name: "Pathway Lights" },
          "2639": { id: "2639", name: "Landscape Flood Lights" },
          "2640": { id: "2640", name: "Outdoor Spotlights" },
          "2641": { id: "2641", name: "Flag Poles" },
          "2642": { id: "2642", name: "Flags" },
          "2643": { id: "2643", name: "Outdoor Fountains" },
          "2644": { id: "2644", name: "Garden Statues" },
          "2645": { id: "2645", name: "Garden Gazing Balls" },
          "2646": { id: "2646", name: "Outdoor Lanterns" },
          "2647": { id: "2647", name: "Patio Torches" },
          "2648": { id: "2648", name: "Landscape Rocks" },
          "2649": { id: "2649", name: "Plant Stands" },
          "2650": { id: "2650", name: "Outdoor Plant Vases" },
          "2651": { id: "2651", name: "Rain Gauges" },
          "2652": { id: "2652", name: "Outdoor String Lights" },
          "2653": { id: "2653", name: "Sundials" },
          "2654": { id: "2654", name: "Outdoor Thermometers" },
          "2655": { id: "2655", name: "Patio Umbrella Lights" },
          "2656": { id: "2656", name: "Weathervanes" },
          "2657": { id: "2657", name: "Wind Chimes" },
          "2658": { id: "2658", name: "Wind Spinners" },
          "2659": { id: "2659", name: "Other Outdoor Decor" }
        }
      },
      "2660": {
        id: "2660",
        name: "Garden Hand Tools & Equipment",
        subcategories: {
          "2661": { id: "2661", name: "Garden Axes" },
          "2662": { id: "2662", name: "Fruit Pickers" },
          "2663": { id: "2663", name: "Garden Augers" },
          "2664": { id: "2664", name: "Garden Carts" },
          "2665": { id: "2665", name: "Garden Forks" },
          "2666": { id: "2666", name: "Garden Hoes" },
          "2667": { id: "2667", name: "Garden Picks" },
          "2668": { id: "2668", name: "Garden Scythes" },
          "2669": { id: "2669", name: "Garden Seeders" },
          "2670": { id: "2670", name: "Garden Sickles" },
          "2671": { id: "2671", name: "Garden Tool Racks" },
          "2672": { id: "2672", name: "Garden Wagons" },
          "2673": { id: "2673", name: "Garden Wheelbarrows" },
          "2674": { id: "2674", name: "Grass Shears" },
          "2675": { id: "2675", name: "Garden Hatchets" },
          "2676": { id: "2676", name: "Hedge Shears" },
          "2677": { id: "2677", name: "Lawn Aerators" },
          "2678": { id: "2678", name: "Lawn Rollers" },
          "2679": { id: "2679", name: "Loppers" },
          "2680": { id: "2680", name: "Manual Edgers" },
          "2681": { id: "2681", name: "Mattocks" },
          "2682": { id: "2682", name: "Post Hole Diggers" },
          "2683": { id: "2683", name: "Pruning Shears" },
          "2684": { id: "2684", name: "Pruning Snips" },
          "2685": { id: "2685", name: "Garden Rakes" },
          "2686": { id: "2686", name: "Pruning Saws" },
          "2687": { id: "2687", name: "Shovels" },
          "2688": { id: "2688", name: "Trowels" },
          "2689": { id: "2689", name: "Weeders" },
          "2690": { id: "2690", name: "Other Garden Hand Tools & Equipment" }
        }
      },
      "2691": {
        id: "2691",
        name: "Garden Protective Gear",
        subcategories: {
          "2692": { id: "2692", name: "Garden Aprons" },
          "2693": { id: "2693", name: "Garden Kneelers" },
          "2694": { id: "2694", name: "Gardening Boots" },
          "2695": { id: "2695", name: "Gardening Gloves" },
          "2696": { id: "2696", name: "Other Garden Protective Gear" }
        }
      },
      "2697": {
        id: "2697",
        name: "Garden Structures & Shades",
        subcategories: {
          "2698": { id: "2698", name: "Arbors & Arches" },
          "2699": { id: "2699", name: "Awnings" },
          "2700": { id: "2700", name: "Canopies" },
          "2701": { id: "2701", name: "Gazebos" },
          "2702": { id: "2702", name: "Outdoor Carports" },
          "2703": { id: "2703", name: "Outdoor Sheds" },
          "2704": { id: "2704", name: "Patio Umbrella Stands" },
          "2705": { id: "2705", name: "Patio Umbrellas" },
          "2706": { id: "2706", name: "Pergolas" },
          "2707": { id: "2707", name: "Tarps" },
          "2708": { id: "2708", name: "Tents" },
          "2709": { id: "2709", name: "Other Structures & Shades" }
        }
      },
      "2710": {
        id: "2710",
        name: "Outdoor Heating & Cooking",
        subcategories: {
          "2711": { id: "2711", name: "Barbecue Grills" },
          "2712": { id: "2712", name: "Charcoal" },
          "2713": { id: "2713", name: "Fire Pits" },
          "2714": { id: "2714", name: "Firewood" },
          "2715": { id: "2715", name: "Patio Heaters" },
          "2716": { id: "2716", name: "Picnic Baskets" },
          "2717": { id: "2717", name: "Smokers" },
          "2718": { id: "2718", name: "Other Heating & Cooking" }
        }
      },
      "2719": {
        id: "2719",
        name: "Outdoor Power Equipment",
        subcategories: {
          "2720": { id: "2720", name: "Chainsaws" },
          "2721": { id: "2721", name: "Chippers" },
          "2722": { id: "2722", name: "Power Edgers" },
          "2724": { id: "2724", name: "Generators" },
          "2725": { id: "2725", name: "Hedge Trimmers" },
          "2726": { id: "2726", name: "Lawn Mowers" },
          "2727": { id: "2727", name: "Leaf Blowers" },
          "2728": { id: "2728", name: "Log Splitters" },
          "2729": { id: "2729", name: "Mulchers" },
          "2730": { id: "2730", name: "Pressure Washers" },
          "2731": { id: "2731", name: "Shredders" },
          "2732": { id: "2732", name: "Snow Blowers" },
          "2733": { id: "2733", name: "String Trimmers" },
          "2734": { id: "2734", name: "Sweepers" },
          "2735": { id: "2735", name: "Tillers" },
          "2736": { id: "2736", name: "Other Outdoor Power Equipment" }
        }
      },
      "2737": {
        id: "2737",
        name: "Outdoor Waste & Composting",
        subcategories: {
          "2738": { id: "2738", name: "Compost Accelerators" },
          "2739": { id: "2739", name: "Compost Aerators" },
          "2740": { id: "2740", name: "Garden Compost Bins" },
          "2741": { id: "2741", name: "Garden Waste Bags" },
          "2742": { id: "2742", name: "Garden Waste Bins" },
          "2743": { id: "2743", name: "Other Composting & Yard Waste" }
        }
      },
      "2744": {
        id: "2744",
        name: "Patio Furniture",
        subcategories: {
          "2745": { id: "2745", name: "Hammocks" },
          "2746": { id: "2746", name: "Patio Loungers" },
          "2747": { id: "2747", name: "Outdoor Daybeds" },
          "2748": { id: "2748", name: "Outdoor Furniture Covers" },
          "2749": { id: "2749", name: "Patio Benches" },
          "2750": { id: "2750", name: "Patio Chairs" },
          "2751": { id: "2751", name: "Patio Furniture Cushions" },
          "2752": { id: "2752", name: "Patio Furniture Sets" },
          "2753": { id: "2753", name: "Patio Tables" },
          "2754": { id: "2754", name: "Porch Swings" },
          "2755": { id: "2755", name: "Storage Deck Boxes" },
          "2756": { id: "2756", name: "Other Patio Furniture" }
        }
      },
      "2757": {
        id: "2757",
        name: "Planting Accessories",
        subcategories: {
          "2758": { id: "2758", name: "Garden Fertilizers" },
          "2759": { id: "2759", name: "Garden Hangers" },
          "2760": { id: "2760", name: "Garden Hooks" },
          "2761": { id: "2761", name: "Garden Saucers" },
          "2762": { id: "2762", name: "Garden Sprayers" },
          "2763": { id: "2763", name: "Mulch" },
          "2764": { id: "2764", name: "Plant Labels" },
          "2765": { id: "2765", name: "Plant Ties & Supports" },
          "2766": { id: "2766", name: "Gardening Planters" },
          "2767": { id: "2767", name: "Gardening Pots" },
          "2768": { id: "2768", name: "Seed Starter Pots" },
          "2769": { id: "2769", name: "Soil" },
          "2770": { id: "2770", name: "Window Planting Boxes" },
          "2771": { id: "2771", name: "Other Planting Accessories" }
        }
      },
      "2772": {
        id: "2772",
        name: "Live Plants",
        subcategories: {
          "2773": { id: "2773", name: "Annual Plants" },
          "2774": { id: "2774", name: "Flower Bulbs" },
          "2775": { id: "2775", name: "Fruit Plants" },
          "2776": { id: "2776", name: "Garden Bushes" },
          "2777": { id: "2777", name: "Hanging Plants" },
          "2778": { id: "2778", name: "Indoor Plants" },
          "2779": { id: "2779", name: "Perennial Plants" },
          "2780": { id: "2780", name: "Seeds" },
          "2781": { id: "2781", name: "Succulents" },
          "2782": { id: "2782", name: "Vegetable Plants" },
          "2783": { id: "2783", name: "Other Live Plants" }
        }
      },
      "2784": {
        id: "2784",
        name: "Pool Equipment",
        subcategories: {
          "2785": { id: "2785", name: "Above-Ground Pools" },
          "2786": { id: "2786", name: "Inflatable Pools" },
          "2787": { id: "2787", name: "Pool Brushes" },
          "2788": { id: "2788", name: "Pool Clarifiers" },
          "2789": { id: "2789", name: "Pool Cleaners" },
          "2790": { id: "2790", name: "Pool Covers & Reels" },
          "2791": { id: "2791", name: "Pool Diving Boards" },
          "2792": { id: "2792", name: "Pool Fences" },
          "2793": { id: "2793", name: "Pool Filters" },
          "2794": { id: "2794", name: "Pool Heaters" },
          "2795": { id: "2795", name: "Pool Hoses" },
          "2796": { id: "2796", name: "Pool Ladders & Steps" },
          "2797": { id: "2797", name: "Pool Lights" },
          "2798": { id: "2798", name: "Pool Liners" },
          "2799": { id: "2799", name: "Pool Nets" },
          "2800": { id: "2800", name: "Pool Pumps" },
          "2801": { id: "2801", name: "Pool Slides" },
          "2802": { id: "2802", name: "Pool Thermometers" },
          "2803": { id: "2803", name: "Pool Vacuums" },
          "2804": { id: "2804", name: "Pool Water Levelers" },
          "2805": { id: "2805", name: "Other Pool Equipment" }
        }
      },
      "2806": {
        id: "2806",
        name: "Sauna & Hot Tub Equipment",
        subcategories: {
          "2807": { id: "2807", name: "Hot Tubs" },
          "2808": { id: "2808", name: "Sauna Heaters" },
          "2809": { id: "2809", name: "Sauna Theromometers" },
          "2810": { id: "2810", name: "Saunas" },
          "2811": { id: "2811", name: "Spa & Hot Tub Covers" },
          "2812": { id: "2812", name: "Other Sauna & Hot Tub Equipment" }
        }
      },
      "2813": {
        id: "2813",
        name: "Watering Equipment",
        subcategories: {
          "2814": { id: "2814", name: "Hose Nozzles" },
          "2815": { id: "2815", name: "Hose Reels" },
          "2816": { id: "2816", name: "Water Hoses" },
          "2817": { id: "2817", name: "Lawn Sprinklers" },
          "2818": { id: "2818", name: "Rain Barrels" },
          "2819": { id: "2819", name: "Spigots" },
          "2820": { id: "2820", name: "Spray Guns" },
          "2821": { id: "2821", name: "Sprinkler Heads" },
          "2822": { id: "2822", name: "Water Pumps" },
          "2823": { id: "2823", name: "Watering Cans" },
          "2824": { id: "2824", name: "Other Watering Equipment" }
        }
      }
    }
  },
  "2882": {
    id: "2882",
    name: "Office",
    subcategories: {
      "1533": {
        id: "1533",
        name: "School Supplies",
        subcategories: {
          "2950": { id: "2950", name: "Binders" },
          "2951": { id: "2951", name: "Binding Covers" },
          "2952": { id: "2952", name: "Binding Spines" },
          "2953": { id: "2953", name: "Calculators" },
          "2954": { id: "2954", name: "Glue Sticks" },
          "2955": { id: "2955", name: "Highlighters" },
          "2956": { id: "2956", name: "Index Cards" },
          "2957": { id: "2957", name: "Pencil Sharpeners" },
          "2958": { id: "2958", name: "Protractors" },
          "2959": { id: "2959", name: "Rulers" },
          "2960": { id: "2960", name: "Scissors" },
          "2961": { id: "2961", name: "Other School Supplies" }
        }
      },
      "1534": {
        id: "1534",
        name: "Ink & Toner",
        subcategories: {
          "2899": { id: "2899", name: "Ink Cartidges" },
          "2900": { id: "2900", name: "Ink Refills" },
          "2901": { id: "2901", name: "Ink Ribbons" },
          "2902": { id: "2902", name: "Toner Cartridges" },
          "2903": { id: "2903", name: "Toner Refills" },
          "2904": { id: "2904", name: "Other Ink & Toner" }
        }
      },
      "1535": {
        id: "1535",
        name: "Paper",
        subcategories: {
          "2941": { id: "2941", name: "Cardstock" },
          "2942": { id: "2942", name: "Cash Register Rolls" },
          "2943": { id: "2943", name: "Certificate Paper" },
          "2944": { id: "2944", name: "Construction Paper" },
          "2945": { id: "2945", name: "Copy & Multipurpose Paper" },
          "2946": { id: "2946", name: "Filler Paper" },
          "2947": { id: "2947", name: "Graph Paper" },
          "2948": { id: "2948", name: "Photo Paper" },
          "2949": { id: "2949", name: "Other Office Paper" }
        }
      },
      "1536": {
        id: "1536",
        name: "Writing Supplies",
        subcategories: {
          "2997": { id: "2997", name: "Erasers" },
          "2999": { id: "2999", name: "Mechanical Pencil Lead Refills" },
          "3000": { id: "3000", name: "Mechanical Pencils" },
          "3001": { id: "3001", name: "Pencil Cases" },
          "3002": { id: "3002", name: "Pencils" },
          "3007": { id: "3007", name: "Other Writing Supplies" }
        }
      },
      "1537": {
        id: "1537",
        name: "Office Electronics",
        subcategories: {
          "2913": { id: "2913", name: "Cash Registers" },
          "2914": { id: "2914", name: "Label Makers" },
          "2915": { id: "2915", name: "Laminators" },
          "2916": { id: "2916", name: "Office Calculators" },
          "2917": { id: "2917", name: "Shredders" },
          "2918": { id: "2918", name: "Other Office Electronics" }
        }
      },
      "1538": {
        id: "1538",
        name: "Desk Organization",
        subcategories: {
          "2883": { id: "2883", name: "Bookends" },
          "2884": { id: "2884", name: "Business Card Holders" },
          "2885": { id: "2885", name: "Desk Organizers" },
          "2886": { id: "2886", name: "Desk Trays" },
          "2887": { id: "2887", name: "Desk Drawer Organizers" },
          "2888": { id: "2888", name: "File Organizers" },
          "2889": { id: "2889", name: "Magazine Holders" },
          "2890": { id: "2890", name: "Wall Files" },
          "2891": { id: "2891", name: "Other Desk Organization" }
        }
      },
      "1539": {
        id: "1539",
        name: "Shipping Supplies",
        subcategories: {
          "2962": { id: "2962", name: "Address Labels" },
          "2963": { id: "2963", name: "Air Pillows & Inflatable Packaging" },
          "2964": { id: "2964", name: "Bubble Mailers" },
          "2965": { id: "2965", name: "Bubble Rolls" },
          "2966": { id: "2966", name: "Business Envelopes" },
          "2967": { id: "2967", name: "Catalog Envelopes" },
          "2968": { id: "2968", name: "Corrugated Mailers" },
          "2969": { id: "2969", name: "Cushioning Bags" },
          "2970": { id: "2970", name: "Cushioning Sheets" },
          "2971": { id: "2971", name: "Double Sided Tape" },
          "2972": { id: "2972", name: "Envelope Sealers" },
          "2973": { id: "2973", name: "Flat Mailers" },
          "2974": { id: "2974", name: "Foam Rolls" },
          "2975": { id: "2975", name: "Interdepartmental Envelopes" },
          "2976": { id: "2976", name: "Invitation Envelopes" },
          "2977": { id: "2977", name: "Letter Openers" },
          "2978": { id: "2978", name: "Mailing Tubes" },
          "2979": { id: "2979", name: "Mini Envelopes" },
          "2980": { id: "2980", name: "Packing Peanuts" },
          "2981": { id: "2981", name: "Packing Tape" },
          "2982": { id: "2982", name: "Poly Bags" },
          "2983": { id: "2983", name: "Shipping Boxes" },
          "2984": { id: "2984", name: "Shipping Labels" },
          "2985": { id: "2985", name: "Shipping Tags" },
          "2986": { id: "2986", name: "Window Envelopes" },
          "2987": { id: "2987", name: "Other Shipping Supplies" },
          "3478": { id: "3478", name: "Postage Stamps" }
        }
      },
      "2892": {
        id: "2892",
        name: "Folders & Filing",
        subcategories: {
          "2893": { id: "2893", name: "Accordion Folders" },
          "2894": { id: "2894", name: "Classification Folders" },
          "2895": { id: "2895", name: "Filing Folders" },
          "2896": { id: "2896", name: "Hanging File Folders" },
          "2897": { id: "2897", name: "Pocket Folders" },
          "2898": { id: "2898", name: "Other Folders & Filing" }
        }
      },
      "2905": {
        id: "2905",
        name: "Notebooks & Writing Pads",
        subcategories: {
          "2906": { id: "2906", name: "Address Books" },
          "2907": { id: "2907", name: "Composition Books" },
          "2908": { id: "2908", name: "Journals" },
          "2909": { id: "2909", name: "Note Pads" },
          "2910": { id: "2910", name: "Notebooks" },
          "2911": { id: "2911", name: "Writing Pads" },
          "2912": { id: "2912", name: "Other Notebooks & Writing Pads" }
        }
      },
      "2988": {
        id: "2988",
        name: "Tapes & Adhesives",
        subcategories: {
          "2989": { id: "2989", name: "Duct Tape" },
          "2990": { id: "2990", name: "Electrical Tape" },
          "2991": { id: "2991", name: "Masking Tape" },
          "2992": { id: "2992", name: "Mounting Tape" },
          "2993": { id: "2993", name: "Painters Tape" }
        }
      },
      "3479": {
        id: "3479",
        name: "Markers",
        subcategories: {
          "2996": { id: "2996", name: "Dry Erase Markers" },
          "3003": { id: "3003", name: "Permanent Markers" },
          "3006": { id: "3006", name: "Washable Markers" },
          "3480": { id: "3480", name: "Alcohol-Based Markers" },
          "3481": { id: "3481", name: "Brush Markers" },
          "3482": { id: "3482", name: "Dual Tip Art Markers" },
          "3483": { id: "3483", name: "Paint Markers" },
          "3484": { id: "3484", name: "Marker Refills" },
          "3485": { id: "3485", name: "Other Markers" }
        }
      },
      "3486": {
        id: "3486",
        name: "Pens",
        subcategories: {
          "2994": { id: "2994", name: "Ballpoint Pens" },
          "2995": { id: "2995", name: "Calligraphy Pens" },
          "2998": { id: "2998", name: "Gel Pens" },
          "3004": { id: "3004", name: "Retractable Pens" },
          "3005": { id: "3005", name: "Rollerball Pens" },
          "3487": { id: "3487", name: "Archival Ink Pens" },
          "3488": { id: "3488", name: "Paintpens" },
          "3489": { id: "3489", name: "Brush Pens" },
          "3490": { id: "3490", name: "Felt Tip Pens" },
          "3491": { id: "3491", name: "Fineliner Pens" },
          "3492": { id: "3492", name: "Fountain Pens" },
          "3493": { id: "3493", name: "Pen Refills" },
          "3494": { id: "3494", name: "Other Pens" }
        }
      }
    }
  },
  "3170": {
    id: "3170",
    name: "Tools",
    subcategories: {
      "3171": {
        id: "3171",
        name: "Air Tools",
        subcategories: {
          "3172": { id: "3172", name: "Air Blow Guns" },
          "3173": { id: "3173", name: "Air Compressors" },
          "3174": { id: "3174", name: "Air Cut Off Tools" },
          "3175": { id: "3175", name: "Air Drills" },
          "3176": { id: "3176", name: "Air Grinders" },
          "3177": { id: "3177", name: "Air Hammers" },
          "3178": { id: "3178", name: "Air Hoses" },
          "3179": { id: "3179", name: "Air Impact Wrenches" },
          "3180": { id: "3180", name: "Air Nailer" },
          "3181": { id: "3181", name: "Air Polishers" },
          "3182": { id: "3182", name: "Air Pressure Regulators" },
          "3183": { id: "3183", name: "Air Ratchet Wrenches" },
          "3184": { id: "3184", name: "Air Sanders" },
          "3185": { id: "3185", name: "Air Sprayers" },
          "3186": { id: "3186", name: "Air Tool Fittings" },
          "3187": { id: "3187", name: "Grease Guns" },
          "3188": { id: "3188", name: "Inflators" },
          "3189": { id: "3189", name: "Other Air Tools" }
        }
      },
      "3190": {
        id: "3190",
        name: "Chains & Ropes",
        subcategories: {
          "3191": { id: "3191", name: "Carabiners" },
          "3192": { id: "3192", name: "Chains" },
          "3193": { id: "3193", name: "Rope & Chain Connectors" },
          "3194": { id: "3194", name: "Ropes" },
          "3195": { id: "3195", name: "Wire Ropes" },
          "3196": { id: "3196", name: "Other Chain & Ropes" }
        }
      },
      "3197": {
        id: "3197",
        name: "Cutting Tools",
        subcategories: {
          "3198": { id: "3198", name: "Bolt Cutters" },
          "3199": { id: "3199", name: "Glass Cutters" },
          "3200": { id: "3200", name: "Jigs" },
          "3201": { id: "3201", name: "Machetes" },
          "3202": { id: "3202", name: "Miter Boxes" },
          "3203": { id: "3203", name: "Planes" },
          "3204": { id: "3204", name: "Other Cutting Tools" }
        }
      },
      "3205": {
        id: "3205",
        name: "Electrical Tools",
        subcategories: {
          "3206": { id: "3206", name: "Cable Cutters" },
          "3207": { id: "3207", name: "Cable Pliers" },
          "3208": { id: "3208", name: "Cable Pullers" },
          "3209": { id: "3209", name: "Conduit Benders" },
          "3210": { id: "3210", name: "Connector Tool Kits" },
          "3211": { id: "3211", name: "Crimping Dies" },
          "3212": { id: "3212", name: "Electrical Tool Kits" },
          "3213": { id: "3213", name: "Electrical Tweezers" },
          "3214": { id: "3214", name: "Fusion Splicers & Cleavers" },
          "3215": { id: "3215", name: "Soldering Guns" },
          "3216": { id: "3216", name: "Soldering Irons" },
          "3217": { id: "3217", name: "Wire Stripping Machines" },
          "3218": { id: "3218", name: "Other Electrical Tools" }
        }
      },
      "3219": {
        id: "3219",
        name: "Fastening Tools",
        subcategories: {
          "3220": { id: "3220", name: "C-Clamps" },
          "3221": { id: "3221", name: "Clamps" },
          "3222": { id: "3222", name: "Rivet Tools" },
          "3223": { id: "3223", name: "Staple Guns" },
          "3224": { id: "3224", name: "Staples" },
          "3225": { id: "3225", name: "Vises" },
          "3226": { id: "3226", name: "Other Fastening Tools" }
        }
      },
      "3227": {
        id: "3227",
        name: "Hammers",
        subcategories: {
          "3228": { id: "3228", name: "Ball-Peen Hammers" },
          "3229": { id: "3229", name: "Claw Hammers" },
          "3230": { id: "3230", name: "Mallets" },
          "3231": { id: "3231", name: "Sledgehammers" },
          "3232": { id: "3232", name: "Other Hammers" }
        }
      },
      "3233": {
        id: "3233",
        name: "Hand Tools",
        subcategories: {
          "3234": { id: "3234", name: "Adapters & Extenders" },
          "3235": { id: "3235", name: "Caulking & Sealing Guns" },
          "3236": { id: "3236", name: "Chisels" },
          "3237": { id: "3237", name: "Drill Bits" },
          "3238": { id: "3238", name: "Hand Crimpers" },
          "3239": { id: "3239", name: "Hex Keys" },
          "3240": { id: "3240", name: "Knives & Cutters" },
          "3241": { id: "3241", name: "Nut Drivers" },
          "3242": { id: "3242", name: "Pry Bars" },
          "3243": { id: "3243", name: "Punches" },
          "3244": { id: "3244", name: "Ratchets" },
          "3245": { id: "3245", name: "Sockets" },
          "3246": { id: "3246", name: "Stud Finders" },
          "3247": { id: "3247", name: "Wire Strippers" },
          "3248": { id: "3248", name: "Other Hand Tools" }
        }
      },
      "3249": {
        id: "3249",
        name: "Measuring & Layout",
        subcategories: {
          "3250": { id: "3250", name: "Calipers" },
          "3251": { id: "3251", name: "Laser Levels" },
          "3252": { id: "3252", name: "Levels" },
          "3253": { id: "3253", name: "Measuring Tapes" },
          "3254": { id: "3254", name: "Measuring Wheels" },
          "3255": { id: "3255", name: "Range Meters" },
          "3256": { id: "3256", name: "Other Measuring & Layout" }
        }
      },
      "3257": {
        id: "3257",
        name: "Pliers",
        subcategories: {
          "3258": { id: "3258", name: "Cutting Pliers" },
          "3259": { id: "3259", name: "Needle Nose Pliers" },
          "3260": { id: "3260", name: "Slip Joint Pliers" },
          "3261": { id: "3261", name: "Tongue & Groove Pliers" },
          "3262": { id: "3262", name: "Other Pliers" }
        }
      },
      "3263": {
        id: "3263",
        name: "Power Tools",
        subcategories: {
          "3264": { id: "3264", name: "Buffers & Polishers" },
          "3265": { id: "3265", name: "Combo Tool Sets" },
          "3266": { id: "3266", name: "Cordless Ratchets" },
          "3267": { id: "3267", name: "Grinders" },
          "3268": { id: "3268", name: "Hammer Drills" },
          "3269": { id: "3269", name: "Heat Guns" },
          "3270": { id: "3270", name: "Impact Drivers" },
          "3271": { id: "3271", name: "Impact Wrenches" },
          "3272": { id: "3272", name: "Lathes" },
          "3273": { id: "3273", name: "Multi-Tools" },
          "3274": { id: "3274", name: "Nail Guns" },
          "3275": { id: "3275", name: "Power Cutting Tools" },
          "3276": { id: "3276", name: "Power Drills" },
          "3277": { id: "3277", name: "Power Riveters" },
          "3278": { id: "3278", name: "Right Angle Drills" },
          "3279": { id: "3279", name: "Rotary Drills" },
          "3280": { id: "3280", name: "Routers" },
          "3281": { id: "3281", name: "Sanders" },
          "3282": { id: "3282", name: "Screw Guns" },
          "3283": { id: "3283", name: "Other Power Tools" }
        }
      },
      "3284": {
        id: "3284",
        name: "Power Tool Accessories",
        subcategories: {
          "3285": { id: "3285", name: "Power Tool Batteries" },
          "3286": { id: "3286", name: "Power Tool Battery Chargers" },
          "3287": { id: "3287", name: "Other Power Tool Accessories" }
        }
      },
      "3288": {
        id: "3288",
        name: "Safety Gear",
        subcategories: {
          "3289": { id: "3289", name: "Back Support Belts" },
          "3290": { id: "3290", name: "Bump Caps" },
          "3291": { id: "3291", name: "Disposable Coveralls" },
          "3292": { id: "3292", name: "Disposable Gloves" },
          "3293": { id: "3293", name: "Ear Muffs" },
          "3294": { id: "3294", name: "Ear Plugs" },
          "3295": { id: "3295", name: "Emergency Response" },
          "3296": { id: "3296", name: "Face Shields" },
          "3297": { id: "3297", name: "First Aid Kits" },
          "3298": { id: "3298", name: "Hard Hats" },
          "3299": { id: "3299", name: "Knee Pads" },
          "3300": { id: "3300", name: "Lifelines" },
          "3301": { id: "3301", name: "PPE Kits" },
          "3302": { id: "3302", name: "Safety Glasses" },
          "3303": { id: "3303", name: "Safety Goggles" },
          "3304": { id: "3304", name: "Safety Vests" },
          "3305": { id: "3305", name: "Shoe Covers" },
          "3306": { id: "3306", name: "Work Gloves" },
          "3307": { id: "3307", name: "Other Safety Gear" }
        }
      },
      "3308": {
        id: "3308",
        name: "Saws",
        subcategories: {
          "3309": { id: "3309", name: "Band Saws" },
          "3310": { id: "3310", name: "Circular Saws" },
          "3311": { id: "3311", name: "Hand Saws" },
          "3312": { id: "3312", name: "Jigsaws" },
          "3313": { id: "3313", name: "Miter Saws" },
          "3314": { id: "3314", name: "Reciprocating Saws" },
          "3315": { id: "3315", name: "Tables Saws" },
          "3316": { id: "3316", name: "Other Saws" }
        }
      },
      "3317": {
        id: "3317",
        name: "Saw Accessories",
        subcategories: {
          "3318": { id: "3318", name: "Bandsaw Blades" },
          "3319": { id: "3319", name: "Circular Saw Blades" },
          "3320": { id: "3320", name: "Diamond Blades" },
          "3321": { id: "3321", name: "Jigsaw Blades" },
          "3322": { id: "3322", name: "Reciprocating Saw Blades" },
          "3323": { id: "3323", name: "Scroll Saw Blades" },
          "3324": { id: "3324", name: "Other Saw Accessories" }
        }
      },
      "3325": {
        id: "3325",
        name: "Screwdrivers",
        subcategories: {
          "3326": { id: "3326", name: "Multi-bit Screwdrivers" },
          "3327": { id: "3327", name: "Phillips Screwdrivers" },
          "3328": { id: "3328", name: "Screwdriver Bits" },
          "3329": { id: "3329", name: "Screwdriver Sets" },
          "3330": { id: "3330", name: "Slotted Screwdrivers" },
          "3331": { id: "3331", name: "Other Screwdrivers" }
        }
      },
      "3332": {
        id: "3332",
        name: "Tie Downs",
        subcategories: {
          "3333": { id: "3333", name: "Bungee Cords" },
          "3334": { id: "3334", name: "Cargo Bars" },
          "3335": { id: "3335", name: "Cargo Nets" },
          "3336": { id: "3336", name: "D-Ring Anchors" },
          "3337": { id: "3337", name: "Load Binders" },
          "3338": { id: "3338", name: "Pulleys" },
          "3339": { id: "3339", name: "Ratchet Straps" },
          "3340": { id: "3340", name: "Tarp Straps" },
          "3341": { id: "3341", name: "Winch Straps" },
          "3342": { id: "3342", name: "Other Tie Downs" }
        }
      },
      "3343": {
        id: "3343",
        name: "Tools Storage",
        subcategories: {
          "3344": { id: "3344", name: "Tool Bags" },
          "3345": { id: "3345", name: "Tool Belts" },
          "3346": { id: "3346", name: "Tool Chests" },
          "3347": { id: "3347", name: "Workbenches" },
          "3348": { id: "3348", name: "Other Tools Storage" }
        }
      },
      "3349": {
        id: "3349",
        name: "Welding Equipment",
        subcategories: {
          "3350": { id: "3350", name: "Spot Welders" },
          "3351": { id: "3351", name: "Welding Cables" },
          "3352": { id: "3352", name: "Welding Clamps" },
          "3353": { id: "3353", name: "Welding Fuel Cylinders" },
          "3354": { id: "3354", name: "Welding Helmet" },
          "3355": { id: "3355", name: "Welding Hoses" },
          "3356": { id: "3356", name: "Welding Machines" },
          "3357": { id: "3357", name: "Welding Tips" },
          "3358": { id: "3358", name: "Welding Torches" },
          "3359": { id: "3359", name: "Welding Valves" },
          "3360": { id: "3360", name: "Welding Wire" },
          "3361": { id: "3361", name: "Other Welding Equipment" }
        }
      },
      "3362": {
        id: "3362",
        name: "Wrenches",
        subcategories: {
          "3363": { id: "3363", name: "Adjustable Wrenches" },
          "3364": { id: "3364", name: "Box Wrenches" },
          "3365": { id: "3365", name: "Combination Wrenches" },
          "3366": { id: "3366", name: "Crescent Wrenches" },
          "3367": { id: "3367", name: "Open-End Wrenches" },
          "3368": { id: "3368", name: "Torque Wrenches" },
          "3369": { id: "3369", name: "Wrench Sets" },
          "3370": { id: "3370", name: "Other Wrenches" }
        }
      }
    }
  },
  "141": {
    id: "141",
    name: "Books",
    subcategories: {
      "142": {
        id: "142",
        name: "Magazines",
        subcategories: {
          "1495": { id: "1495", name: "Lifestyle & Culture Magazines" },
          "1496": { id: "1496", name: "International Magazines" },
          "1497": { id: "1497", name: "Professional & Trade Magazines" },
          "1498": { id: "1498", name: "Other Magazines" }
        }
      },
      "1011": {
        id: "1011",
        name: "Fiction Books",
        subcategories: {
          "1010": { id: "1010", name: "Comics" },
          "1023": { id: "1023", name: "Sci-fi & Fantasy Books" },
          "1482": { id: "1482", name: "Literary Fiction Books" },
          "1487": { id: "1487", name: "Fictional Children's Books" },
          "3513": { id: "3513", name: "Manga" },
          "3514": { id: "3514", name: "Romance Fiction Books" },
          "3515": { id: "3515", name: "Horror Fiction Books" },
          "3516": { id: "3516", name: "Western Books" },
          "3517": { id: "3517", name: "Historical Fiction Books" },
          "3518": { id: "3518", name: "Mystery & Crime Fiction Books" },
          "3519": { id: "3519", name: "Thriller Fiction Books" },
          "3520": { id: "3520", name: "Other Fiction Books" },
          "3529": { id: "3529", name: "Action & Adventure Books" }
        }
      },
      "1016": {
        id: "1016",
        name: "Nonfiction Books",
        subcategories: {
          "1018": { id: "1018", name: "Craft Books" },
          "1483": { id: "1483", name: "Business & Finance Books" },
          "1484": { id: "1484", name: "Politics Books" },
          "1486": { id: "1486", name: "Religion & Spirituality Books" },
          "1492": { id: "1492", name: "Biographies & Memoirs" },
          "2184": { id: "2184", name: "Art Books" },
          "2185": { id: "2185", name: "Photography Books" },
          "3521": { id: "3521", name: "Nonfiction Children's Books" },
          "3522": { id: "3522", name: "Other Nonfiction Books" }
        }
      },
      "1480": {
        id: "1480",
        name: "Reference Books",
        subcategories: {
          "1012": { id: "1012", name: "Cookbooks" },
          "1017": { id: "1017", name: "Other Reference Books" },
          "1489": { id: "1489", name: "Educational & Instructional Books" },
          "3523": { id: "3523", name: "Dictionaries" },
          "3524": { id: "3524", name: "Thesauruses" },
          "3525": { id: "3525", name: "Encyclopedias" },
          "3526": { id: "3526", name: "Textbooks" },
          "3530": { id: "3530", name: "Health & Fitness Books" },
          "3531": { id: "3531", name: "Self-Help Books" }
        }
      },
      "1494": { id: "1494", name: "Other Books" }
    }
  },
  "10": {
    id: "10",
    name: "Other",
    subcategories: {
      "144": {
        id: "144",
        name: "Daily & travel items",
        subcategories: {
          "1509": { id: "1509", name: "Baby & child care" },
          "1510": { id: "1510", name: "Health care" },
          "1511": { id: "1511", name: "Household supplies" },
          "1512": { id: "1512", name: "Medical supplies & equipment" },
          "1513": { id: "1513", name: "Personal care" },
          "1514": { id: "1514", name: "Sports Shaker Bottles" },
          "1516": { id: "1516", name: "Other" },
          "2187": { id: "2187", name: "Stationery" }
        }
      },
      "145": {
        id: "145",
        name: "Automotive",
        subcategories: {
          "1517": { id: "1517", name: "Car care" },
          "1518": { id: "1518", name: "Car electronics & accessories" },
          "1519": { id: "1519", name: "Exterior accessories" },
          "1520": { id: "1520", name: "Interior accessories" },
          "1522": { id: "1522", name: "Motorcycle & powersports" },
          "1524": { id: "1524", name: "Paint, body & trim" },
          "1525": { id: "1525", name: "Performance parts & accessories" },
          "1526": { id: "1526", name: "Replacement parts" },
          "1527": { id: "1527", name: "RV parts & accessories" },
          "1529": { id: "1529", name: "Tools & equipment" },
          "1530": { id: "1530", name: "Automotive enthusiast merchandise" },
          "1531": { id: "1531", name: "Other" },
          "2188": { id: "2188", name: "Automotive Lighting Accessories" },
          "2189": { id: "2189", name: "Automotive Lights" },
          "2190": { id: "2190", name: "Automotive Tire & Wheel Accessories" },
          "2191": { id: "2191", name: "Automotive Tires" },
          "2192": { id: "2192", name: "Automotive Wheels & Rims" }
        }
      },
      "146": {
        id: "146",
        name: "Office Supplies",
        subcategories: {
          "1532": { id: "1532", name: "Basic supplies" },
          "1540": { id: "1540", name: "Desk Calendars" },
          "1541": { id: "1541", name: "Presentation" },
          "1542": { id: "1542", name: "Furniture" },
          "1543": { id: "1543", name: "Other Office Supplies" },
          "2919": { id: "2919", name: "Binder Clips" },
          "2920": { id: "2920", name: "Clipboards" },
          "2921": { id: "2921", name: "Correction Fluid" },
          "2922": { id: "2922", name: "Dry Erase Calendar Boards" },
          "2923": { id: "2923", name: "Paper Clips" },
          "2924": { id: "2924", name: "Paper Cutters" },
          "2925": { id: "2925", name: "Paper Punchers" },
          "2926": { id: "2926", name: "Planners" },
          "2927": { id: "2927", name: "Post-it Sticky Notes" },
          "2928": { id: "2928", name: "Push Pins" },
          "2929": { id: "2929", name: "Rubber Bands" },
          "2930": { id: "2930", name: "Scotch Tape" },
          "2931": { id: "2931", name: "Sheet Protectors" },
          "2932": { id: "2932", name: "Staple Removers" },
          "2933": { id: "2933", name: "Staplers" },
          "2934": { id: "2934", name: "Staples" },
          "2935": { id: "2935", name: "Tab Dividers" },
          "2936": { id: "2936", name: "Tape Dispensers" },
          "2937": { id: "2937", name: "Wall Calendars" },
          "2938": { id: "2938", name: "Wall Clips" },
          "2939": { id: "2939", name: "Wall Hooks" },
          "2940": { id: "2940", name: "Whiteboards" }
        }
      },
      "147": {
        id: "147",
        name: "Musical instruments",
        subcategories: {
          "1544": { id: "1544", name: "Guitars" },
          "1545": { id: "1545", name: "Bass guitars" },
          "1547": { id: "1547", name: "Keyboards" },
          "1550": { id: "1550", name: "Brass instruments" },
          "1551": { id: "1551", name: "Stringed instruments" },
          "1552": { id: "1552", name: "Wind & woodwind instruments" },
          "1553": { id: "1553", name: "Band & orchestra" },
          "1554": { id: "1554", name: "Instrument accessories" },
          "1555": { id: "1555", name: "Live sound & stage" },
          "1558": { id: "1558", name: "Other" },
          "2193": { id: "2193", name: "Drums" },
          "2194": { id: "2194", name: "Percussion Instruments" },
          "2195": { id: "2195", name: "Musical Instrument Amplifiers" },
          "2196": { id: "2196", name: "Music Effects" }
        }
      },
      "148": { id: "148", name: "Other" },
      "1033": {
        id: "1033",
        name: "Travel & Luggage",
        subcategories: {
          "3495": { id: "3495", name: "Carry-On Luggage" },
          "3496": { id: "3496", name: "Luggage Carts" },
          "3497": { id: "3497", name: "Luggage Scales" },
          "3498": { id: "3498", name: "Luggage Straps" },
          "3499": { id: "3499", name: "Luggage Tags" },
          "3500": { id: "3500", name: "Suitcases" },
          "3501": { id: "3501", name: "Travel Bags" },
          "3502": { id: "3502", name: "Other Travel & Luggage" }
        }
      },
      "1523": {
        id: "1523",
        name: "Automotive Oils & Fluids",
        subcategories: {
          "2527": { id: "2527", name: "Automotive Additives" },
          "2528": { id: "2528", name: "Automotive Antifreezes & Coolants" },
          "2529": { id: "2529", name: "Automotive Brake Fluids" },
          "2530": { id: "2530", name: "Automotive Cleaners" },
          "2531": { id: "2531", name: "Automotive Greases" },
          "2532": { id: "2532", name: "Automotive Lubricants" },
          "2533": { id: "2533", name: "Automotive Motor Oils" },
          "2534": { id: "2534", name: "Automotive Power Steering Fluids" },
          "2535": { id: "2535", name: "Automotive Refrigerants" },
          "2536": { id: "2536", name: "Automotive Transmission Fluids" },
          "2537": { id: "2537", name: "Automotive Windshield Fluids" },
          "2538": { id: "2538", name: "Other Automotive Fluids" }
        }
      }
    }
  }
};

const MARKETPLACES = [
  { id: "ebay",     label: "eBay",     icon: EBAY_ICON_URL },
  { id: "facebook", label: "Facebook", icon: FACEBOOK_ICON_URL },
  { id: "mercari",  label: "Mercari",  icon: MERCARI_ICON_URL  },
  { id: "etsy",     label: "Etsy",     icon: ETSY_ICON_URL },
  { id: "poshmark", label: "Poshmark", icon: POSHMARK_ICON_URL },
];

const TEMPLATE_DISPLAY_NAMES = {
  general: "General",
  ebay: "eBay",
  etsy: "Etsy",
  mercari: "Mercari",
  facebook: "Facebook Marketplace",
};

const GENERAL_TEMPLATE_DEFAULT = {
  photos: [],
  title: "",
  description: "",
  brand: "",
  condition: "",
  color1: "",
  color2: "",
  color3: "",
  sku: "",
  zip: "",
  tags: "",
  quantity: "1",
  category: "",
  size: "",
  packageDetails: "",
  packageWeight: "",
  packageLength: "",
  packageWidth: "",
  packageHeight: "",
  price: "",
  cost: "",
  customLabels: "",
  categoryId: "",
};

const MARKETPLACE_TEMPLATE_DEFAULTS = {
  ebay: {
    inheritGeneral: true,
    photos: [],
    title: "",
    description: "",
    brand: "",
    color: "",
    categoryId: "",
    categoryName: "",
    itemType: "",
    ebayBrand: "",
    condition: "",
    model: "",
    sku: "",
    itemsIncluded: "",
    customItemSpecifics: {}, // Store any other required item specifics dynamically
    shippingMethod: "",
    shippingCostType: "",
    shippingCost: "",
    handlingTime: "1 business day",
    shipFromCountry: "United States",
    shippingService: "Standard Shipping (3 to 5 business days)",
    locationDescriptions: "",
    shippingLocation: "",
    acceptReturns: false,
    returnWithin: "30 days",
    returnShippingPayer: "Buyer",
    returnRefundMethod: "Full Refund",
    pricingFormat: "fixed",
    duration: "Good 'Til Canceled",
    buyItNowPrice: "",
    allowBestOffer: true,
  },
  etsy: {
    inheritGeneral: true,
    photos: [],
    title: "",
    description: "",
    brand: "",
    sku: "",
    renewalOption: "manual",
    whoMade: "i_did",
    whenMade: "2020s",
    isDigital: false,
    processingTime: "1-3 business days",
    shippingProfile: "",
    tags: "",
  },
  mercari: {
    inheritGeneral: true,
    photos: [],
    title: "",
    description: "",
    brand: "",
    shippingCarrier: "Mercari Prepaid",
    shippingPrice: "",
    localPickup: false,
    smartPricing: false,
    floorPrice: "",
  },
  facebook: {
    inheritGeneral: true,
    photos: [],
    title: "",
    description: "",
    brand: "",
    condition: "",
    size: "",
    itemType: "",
    color: "",
    megapixels: "",
    quantity: "1",
    price: "",
    tags: "",
    sku: "",
    category: "",
    categoryId: "",
    deliveryMethod: "shipping_and_pickup",
    shippingPrice: "",
    localPickup: true,
    meetUpLocation: "",
    allowOffers: true,
    hideFromFriends: false,
  },
};

const createInitialTemplateState = (item) => {
  // If item has a predefined category, clear it so user can select from eBay category picklist
  const itemCategory = item?.category || "";
  const shouldClearCategory = itemCategory && PREDEFINED_CATEGORIES.includes(itemCategory);
  const category = shouldClearCategory ? "" : itemCategory;
  
  // Load all images from inventory item
  let photos = [];
  if (item?.images && Array.isArray(item.images) && item.images.length > 0) {
    // Use the images array if available
    photos = item.images.map((img, index) => ({
      id: `inventory-photo-${index}`,
      preview: img.imageUrl || img.url || img,
      fileName: `Inventory photo ${index + 1}`,
      fromInventory: true
    }));
  } else if (item?.image_url) {
    // Fallback to single image_url if images array not available
    photos = [{ id: "inventory-photo", preview: item.image_url, fileName: "Inventory photo", fromInventory: true }];
  }
  
  const general = {
    ...GENERAL_TEMPLATE_DEFAULT,
    photos: photos,
    title: item?.item_name || "",
    description: item?.notes || "",
    brand: item?.brand || "",
    condition: item?.condition || "",
    color1: item?.color1 || "",
    color2: item?.color2 || "",
    color3: item?.color3 || "",
    sku: item?.sku || "",
    zip: item?.zip_code || "",
    tags: item?.tags || (shouldClearCategory ? "" : item?.category || ""),
    quantity: item?.quantity != null ? String(item.quantity) : "1",
    category: category,
    size: item?.size || "",
    packageDetails: item?.package_details || "",
    packageWeight: item?.package_weight || "",
    packageLength: item?.package_length || "",
    packageWidth: item?.package_width || "",
    packageHeight: item?.package_height || "",
    price: item?.listing_price != null ? String(item.listing_price) : "",
    cost: item?.purchase_price != null ? String(item.purchase_price) : "",
    customLabels: item?.custom_labels || "",
  };

  return {
    general,
    ebay: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.ebay,
      photos: general.photos || [],
      title: general.title || "",
      description: general.description || "",
      buyItNowPrice: general.price,
      shippingLocation: general.zip,
    },
    etsy: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.etsy,
      photos: general.photos || [],
      title: general.title || "",
      description: general.description || "",
      tags: general.tags,
    },
    mercari: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.mercari,
      photos: general.photos || [],
      title: general.title || "",
      description: general.description || "",
      shippingPrice: general.price ? (Number(general.price) >= 100 ? "Free" : "Buyer pays") : "",
    },
    facebook: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.facebook,
      photos: general.photos || [],
      title: general.title || "",
      description: general.description || "",
      meetUpLocation: general.zip ? `Meet near ${general.zip}` : "",
      shippingPrice: general.price ? (Number(general.price) >= 75 ? "Free shipping" : "") : "",
    },
  };
};

const renderMarketplaceIcon = (marketplace, sizeClass = "w-4 h-4") => {
  if (typeof marketplace.icon === "string" && marketplace.icon.startsWith("http")) {
    return (
      <img
        src={marketplace.icon}
        alt={`${marketplace.label} icon`}
        className={`${sizeClass} object-contain`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center ${sizeClass} text-xs leading-none`}
    >
      {marketplace.icon}
    </span>
  );
};

const POPULAR_BRANDS = [
  "Adidas", "Alo Yoga", "Apple", "Arc'teryx", "ASICS", "Athleta",
  "Beats", "Bose", "Brooks", "Burberry",
  "Calvin Klein", "Carhartt", "Chanel", "Coach", "Columbia", "Converse",
  "Dickies", "Dyson",
  "Fabletics", "Fila", "Forever 21",
  "Gap", "Gucci", "Gymshark",
  "Hasbro", "H&M", "Hugo Boss", "Hydro Flask",
  "Instant Pot",
  "JBL", "Jordan",
  "Kate Spade", "KitchenAid",
  "Lego", "Levi's", "Louis Vuitton", "Lululemon",
  "Mattel", "Michael Kors",
  "New Balance", "Nike", "Ninja", "Nintendo",
  "Patagonia", "Prada", "Puma",
  "Ralph Lauren", "REI", "Reebok",
  "Samsung", "Sony", "Stanley",
  "The North Face", "Tommy Hilfiger", "Tory Burch",
  "Under Armour", "Uniqlo",
  "Vans", "Versace",
  "Wrangler",
  "Yeti",
  "Zara",
];

const COMMON_COLORS = [
  { name: "Black", hex: "#000000" },
  { name: "Beige", hex: "#F5F5DC" },
  { name: "Blue", hex: "#0000FF" },
  { name: "Brown", hex: "#8B4513" },
  { name: "Gold", hex: "#FFD700" },
  { name: "Grey", hex: "#808080" },
  { name: "Green", hex: "#008000" },
  { name: "Orange", hex: "#FFA500" },
  { name: "Pink", hex: "#FFC0CB" },
  { name: "Purple", hex: "#800080" },
  { name: "Red", hex: "#FF0000" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Yellow", hex: "#FFFF00" },
  { name: "White", hex: "#FFFFFF" },
];

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", "France",
  "Italy", "Spain", "Netherlands", "Belgium", "Switzerland", "Austria",
  "Sweden", "Norway", "Denmark", "Finland", "Ireland", "Portugal",
  "Poland", "Czech Republic", "Hungary", "Romania", "Greece", "Japan",
  "China", "South Korea", "India", "Singapore", "Hong Kong", "Taiwan",
  "New Zealand", "Mexico", "Brazil", "Argentina", "Chile", "South Africa",
  "Israel", "United Arab Emirates", "Saudi Arabia", "Turkey", "Russia",
  "Ukraine", "Other"
];

export default function CrosslistComposer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addTag } = useInventoryTags();
  
  // Get item IDs and autoSelect from URL
  const searchParams = new URLSearchParams(location.search);
  const idsParam = searchParams.get('ids');
  const autoSelectParam = searchParams.get('autoSelect');
  const itemIds = idsParam ? idsParam.split(',').filter(Boolean) : [];
  const autoSelect = autoSelectParam !== 'false';
  
  // Fetch inventory items if IDs are provided
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventoryItems"],
    queryFn: () => base44.entities.InventoryItem.list("-purchase_date"),
    initialData: [],
  });
  
  const bulkSelectedItems = useMemo(() => {
    if (itemIds.length === 0) return [];
    return inventory.filter(item => itemIds.includes(item.id));
  }, [inventory, itemIds]);
  
  const [templateForms, setTemplateForms] = useState(() => createInitialTemplateState(null));
  const [activeForm, setActiveForm] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const [currentEditingItemId, setCurrentEditingItemId] = useState(null);
  const [packageDetailsDialogOpen, setPackageDetailsDialogOpen] = useState(false);
  const [brandIsCustom, setBrandIsCustom] = useState(false);
  const [customBrands, setCustomBrands] = useState(() => {
    try {
      const saved = localStorage.getItem('customBrands');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showFacebookMoreDetails, setShowFacebookMoreDetails] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [editingColorField, setEditingColorField] = useState(null);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState([]);
  const [generalCategoryPath, setGeneralCategoryPath] = useState([]);
  const [mercariCategoryPath, setMercariCategoryPath] = useState([]);
  const [descriptionGeneratorOpen, setDescriptionGeneratorOpen] = useState(false);
  const [brandSearchOpen, setBrandSearchOpen] = useState(false);
  const [categorySearchOpen, setCategorySearchOpen] = useState(false);
  const photoInputRef = React.useRef(null);
  const ebayPhotoInputRef = React.useRef(null);
  const etsyPhotoInputRef = React.useRef(null);
  const mercariPhotoInputRef = React.useRef(null);
  const facebookPhotoInputRef = React.useRef(null);
  const [soldDialogOpen, setSoldDialogOpen] = useState(false);
  const [ebaySearchDialogOpen, setEbaySearchDialogOpen] = useState(false);
  const [ebaySearchInitialQuery, setEbaySearchInitialQuery] = useState("");
  
  // eBay OAuth token state
  const [ebayToken, setEbayToken] = useState(() => {
    // Load token from localStorage on mount
    try {
      const stored = localStorage.getItem('ebay_user_token');
      if (stored) {
        const tokenData = JSON.parse(stored);
        // Check if token is expired
        if (tokenData.expires_at && tokenData.expires_at > Date.now()) {
          return tokenData;
        }
        // Token expired, remove it
        localStorage.removeItem('ebay_user_token');
      }
    } catch (e) {
      console.error('Error loading eBay token:', e);
    }
    return null;
  });

  // eBay username state
  const [ebayUsername, setEbayUsername] = useState(() => {
    // Load username from localStorage on mount
    try {
      const stored = localStorage.getItem('ebay_username');
      if (stored) {
        return stored;
      }
    } catch (e) {
      console.error('Error loading eBay username:', e);
    }
    return null;
  });
  
  // eBay listing ID state
  const [ebayListingId, setEbayListingId] = useState(null);

  // Facebook OAuth token state
  const [facebookToken, setFacebookToken] = useState(() => {
    // Load token from localStorage on mount
    try {
      const stored = localStorage.getItem('facebook_access_token');
      if (stored) {
        const tokenData = JSON.parse(stored);
        // Check if token is expired
        if (tokenData.expires_at && tokenData.expires_at > Date.now()) {
          return tokenData;
        }
        // Token expired, remove it
        localStorage.removeItem('facebook_access_token');
      }
    } catch (e) {
      console.error('Error loading Facebook token:', e);
    }
    return null;
  });

  // Facebook pages state
  const [facebookPages, setFacebookPages] = useState([]);
  const [facebookSelectedPage, setFacebookSelectedPage] = useState(null);
  
  // Image Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState({ url: null, photoId: null, marketplace: null, index: null });
  
  // Load listing ID when currentEditingItemId changes
  useEffect(() => {
    if (currentEditingItemId) {
      const stored = localStorage.getItem(`ebay_listing_${currentEditingItemId}`);
      if (stored) {
        setEbayListingId(stored);
      } else {
        // Check inventory item for listing ID
        const inventoryItem = inventory.find(item => item.id === currentEditingItemId);
        if (inventoryItem?.ebay_listing_id) {
          localStorage.setItem(`ebay_listing_${currentEditingItemId}`, inventoryItem.ebay_listing_id);
          setEbayListingId(inventoryItem.ebay_listing_id);
        } else {
          setEbayListingId(null);
        }
      }
    } else {
      setEbayListingId(null);
    }
  }, [currentEditingItemId, inventory]);
  
  // Handle OAuth callback from URL params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    
    // Check for OAuth success
    if (params.get('ebay_auth_success') === '1') {
      const tokenParam = params.get('token');
      if (tokenParam) {
        try {
          const tokenData = JSON.parse(decodeURIComponent(tokenParam));
          const expiresAt = Date.now() + (tokenData.expires_in * 1000);
          
          const tokenToStore = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt,
            expires_in: tokenData.expires_in,
            refresh_token_expires_in: tokenData.refresh_token_expires_in,
            token_type: tokenData.token_type,
          };
          
          // Restore theme IMMEDIATELY before any other operations
          const preservedTheme = sessionStorage.getItem('preserved_theme');
          if (preservedTheme) {
            // Restore theme to localStorage immediately
            localStorage.setItem('theme', preservedTheme);
            // Update DOM immediately
            const root = document.documentElement;
            root.setAttribute('data-theme', preservedTheme);
            // Trigger theme update
            window.dispatchEvent(new Event('storage'));
            // Clean up sessionStorage
            sessionStorage.removeItem('preserved_theme');
          }
          
          // Store token securely
          localStorage.setItem('ebay_user_token', JSON.stringify(tokenToStore));
          setEbayToken(tokenToStore);
          
          // Fetch username after token is stored
          // This will be done in a separate useEffect
          
          // Restore saved form state
          const savedState = sessionStorage.getItem('ebay_oauth_state');
          if (savedState) {
            try {
              const stateData = JSON.parse(savedState);
              // Restore form state
              if (stateData.templateForms) {
                setTemplateForms(stateData.templateForms);
              }
              if (stateData.currentEditingItemId) {
                setCurrentEditingItemId(stateData.currentEditingItemId);
                // Reload item data if we have an item ID and it exists in inventory
                if (stateData.itemIds) {
                  const itemIdsArray = stateData.itemIds.split(',').filter(Boolean);
                  if (itemIdsArray.length > 0) {
                    // Update URL to include item IDs so the page knows which items to show
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('ids', stateData.itemIds);
                    if (stateData.autoSelect !== undefined) {
                      newUrl.searchParams.set('autoSelect', String(stateData.autoSelect));
                    }
                    
                    // Use navigate instead of reload to preserve theme and other preferences
                    navigate(newUrl.pathname + newUrl.search, { replace: true });
                    
                    // Don't reload - let React handle the state restoration
                    return; // Exit early
                  }
                }
              }
              if (stateData.activeForm) {
                setActiveForm(stateData.activeForm);
              }
              if (stateData.selectedCategoryPath) {
                setSelectedCategoryPath(stateData.selectedCategoryPath);
              }
              if (stateData.generalCategoryPath) {
                setGeneralCategoryPath(stateData.generalCategoryPath);
              }
              
              // Clear saved state
              sessionStorage.removeItem('ebay_oauth_state');
            } catch (e) {
              console.error('Error restoring saved state:', e);
            }
          }
          
          toast({
            title: "eBay account connected!",
            description: "Your eBay account has been successfully connected.",
          });
          
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        } catch (e) {
          console.error('Error parsing token:', e);
          toast({
            title: "Connection error",
            description: "Failed to save eBay connection. Please try again.",
            variant: "destructive",
          });
        }
      }
    }
    
    // Check for OAuth errors
    const authError = params.get('ebay_auth_error');
    if (authError) {
      const errorMessage = decodeURIComponent(authError);
      let helpText = errorMessage;
      
      // Provide helpful guidance for common errors
      if (errorMessage.includes('invalid_request') || errorMessage.includes('redirect_uri')) {
        helpText = 'The redirect URL doesn\'t match your eBay Developer Console settings. Please check:\n\n' +
                   '1. Go to developer.ebay.com/my/keys\n' +
                   '2. Verify OAuth 2.0 Redirect URIs match your app URL\n' +
                   '3. Make sure you\'re using the correct environment (Sandbox vs Production)\n\n' +
                   'Open browser console for detailed configuration info.';
      }
      
      toast({
        title: "eBay Connection Failed",
        description: helpText,
        variant: "destructive",
        duration: 10000, // Show longer for complex messages
      });
      
      console.error('eBay OAuth Error Details:', {
        error: errorMessage,
        currentUrl: window.location.href,
        suggestion: 'Visit /api/ebay/auth?debug=true to see your OAuth configuration'
      });
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Handle Facebook OAuth callback
    if (params.get('facebook_auth_success') === '1') {
      const tokenParam = params.get('token');
      if (tokenParam) {
        try {
          const tokenData = JSON.parse(decodeURIComponent(tokenParam));
          
          const tokenToStore = {
            access_token: tokenData.access_token,
            expires_at: tokenData.expires_at || (Date.now() + (tokenData.expires_in * 1000)),
            expires_in: tokenData.expires_in,
            token_type: tokenData.token_type || 'bearer',
          };
          
          // Restore theme IMMEDIATELY before any other operations
          const preservedTheme = sessionStorage.getItem('preserved_theme');
          if (preservedTheme) {
            // Restore theme to localStorage immediately
            localStorage.setItem('theme', preservedTheme);
            // Update DOM immediately
            const root = document.documentElement;
            root.setAttribute('data-theme', preservedTheme);
            // Trigger theme update
            window.dispatchEvent(new Event('storage'));
            // Clean up sessionStorage
            sessionStorage.removeItem('preserved_theme');
          }
          
          // Store token securely
          localStorage.setItem('facebook_access_token', JSON.stringify(tokenToStore));
          setFacebookToken(tokenToStore);
          
          // Fetch pages after token is stored
          // This will be done in a separate useEffect
          
          // Restore saved form state
          const savedState = sessionStorage.getItem('facebook_oauth_state');
          if (savedState) {
            try {
              const stateData = JSON.parse(savedState);
              // Restore form state
              if (stateData.templateForms) {
                setTemplateForms(stateData.templateForms);
              }
              if (stateData.currentEditingItemId) {
                setCurrentEditingItemId(stateData.currentEditingItemId);
                // Reload item data if we have an item ID and it exists in inventory
                if (stateData.itemIds) {
                  const itemIdsArray = stateData.itemIds.split(',').filter(Boolean);
                  if (itemIdsArray.length > 0) {
                    // Update URL to include item IDs so the page knows which items to show
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('ids', stateData.itemIds);
                    if (stateData.autoSelect !== undefined) {
                      newUrl.searchParams.set('autoSelect', String(stateData.autoSelect));
                    }
                    
                    // Use navigate instead of reload to preserve theme and other preferences
                    navigate(newUrl.pathname + newUrl.search, { replace: true });
                    
                    // Don't reload - let React handle the state restoration
                    return; // Exit early
                  }
                }
              }
              if (stateData.activeForm) {
                setActiveForm(stateData.activeForm);
              }
              if (stateData.selectedCategoryPath) {
                setSelectedCategoryPath(stateData.selectedCategoryPath);
              }
              if (stateData.generalCategoryPath) {
                setGeneralCategoryPath(stateData.generalCategoryPath);
              }
              
              // Clear saved state
              sessionStorage.removeItem('facebook_oauth_state');
            } catch (e) {
              console.error('Error restoring saved state:', e);
            }
          }
          
          toast({
            title: "Facebook account connected!",
            description: "Your Facebook account has been successfully connected.",
          });
          
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        } catch (e) {
          console.error('Error parsing Facebook token:', e);
          toast({
            title: "Connection error",
            description: "Failed to save Facebook connection. Please try again.",
            variant: "destructive",
          });
        }
      }
    }
    
    // Check for Facebook OAuth errors
    const facebookAuthError = params.get('facebook_auth_error');
    if (facebookAuthError) {
      const errorMsg = decodeURIComponent(facebookAuthError);
      console.error('Facebook OAuth error:', errorMsg);
      
      let description = errorMsg;
      if (errorMsg.includes('redirect_uri')) {
        description = `${errorMsg}\n\nQuick Fix: Visit /api/facebook/debug to see your redirect URI, then add it to Facebook App Settings > Valid OAuth Redirect URIs`;
      }
      
      toast({
        title: "Facebook Connection Failed",
        description: description,
        variant: "destructive",
        duration: 10000,
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location, toast, navigate]);

  // Fetch Facebook pages when token is available
  useEffect(() => {
    let isMounted = true;
    
    const fetchFacebookPages = async () => {
      if (facebookToken?.access_token) {
        try {
          // Check if token is expired
          if (facebookToken.expires_at && facebookToken.expires_at <= Date.now()) {
            console.warn('Facebook token expired, cannot fetch pages');
            return;
          }

          // Import Facebook client functions
          const { getUserPages } = await import('@/api/facebookClient');
          const pages = await getUserPages();
          
          if (isMounted) {
            setFacebookPages(pages);
            
            // Auto-select first page if available and none selected
            if (pages.length > 0) {
              setFacebookSelectedPage(prev => prev || pages[0]);
            }
          }
        } catch (error) {
          console.error('Error fetching Facebook pages:', error);
          // Don't show error toast here, let the user see it in the UI
        }
      } else {
        // Clear pages if token is removed
        if (isMounted) {
          setFacebookPages([]);
          setFacebookSelectedPage(null);
        }
      }
    };

    fetchFacebookPages();
    
    return () => {
      isMounted = false;
    };
  }, [facebookToken]);

  // Fetch eBay username when token is available
  useEffect(() => {
    const fetchEbayUsername = async () => {
      if (ebayToken?.access_token && !ebayUsername) {
        try {
          // Check if token is expired
          if (ebayToken.expires_at && ebayToken.expires_at <= Date.now()) {
            console.warn('eBay token expired, cannot fetch username');
            return;
          }

          const response = await fetch('/api/ebay/listing', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              operation: 'GetUser',
              userToken: ebayToken.access_token,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            const username = result.User?.UserID;
            if (username) {
              setEbayUsername(username);
              localStorage.setItem('ebay_username', username);
            }
          } else {
            console.error('Failed to fetch eBay username:', response.status);
          }
        } catch (error) {
          console.error('Error fetching eBay username:', error);
        }
      }
    };

    fetchEbayUsername();
  }, [ebayToken, ebayUsername]);
  
  // Get eBay category tree ID
  const { data: categoryTreeData, isLoading: isLoadingCategoryTree, error: categoryTreeError } = useEbayCategoryTreeId('EBAY_US');
  // Extract category tree ID - check multiple possible response structures
  const categoryTreeId = categoryTreeData?.categoryTreeId || categoryTreeData?.category_tree_id || categoryTreeData?.categoryTree?.categoryTreeId || null;
  
  // Debug logging for category tree ID
  useEffect(() => {
    if (!isLoadingCategoryTree) {
      console.log('🔍 Category Tree ID Debug:', {
        isLoadingCategoryTree,
        categoryTreeData,
        categoryTreeId,
        categoryTreeError,
        extractedFrom: {
          categoryTreeId: categoryTreeData?.categoryTreeId,
          category_tree_id: categoryTreeData?.category_tree_id,
          categoryTree_categoryTreeId: categoryTreeData?.categoryTree?.categoryTreeId,
        },
      });
      
      if (categoryTreeError) {
        console.error('❌ Error loading category tree ID:', categoryTreeError);
      } else if (!categoryTreeId) {
        console.warn('⚠️ Category tree ID not found. Full response:', categoryTreeData);
      } else {
        // Note: "0" might be a valid category tree ID for US marketplace!
        console.log('✅ Category tree ID:', categoryTreeId, typeof categoryTreeId);
      }
    }
  }, [categoryTreeId, categoryTreeData, isLoadingCategoryTree, categoryTreeError]);
  
  // Get the current level of categories based on selected path for eBay form
  const ebayCurrentCategoryId = selectedCategoryPath.length > 0 
    ? selectedCategoryPath[selectedCategoryPath.length - 1].categoryId 
    : '0';
  
  // Get the current level of categories based on selected path for General form
  const generalCurrentCategoryId = generalCategoryPath.length > 0 
    ? generalCategoryPath[generalCategoryPath.length - 1].categoryId 
    : '0';
  
  // Categories for eBay form
  const { data: ebayCategoriesData, isLoading: isLoadingEbayCategories, error: ebayCategoriesError } = useEbayCategories(
    categoryTreeId,
    ebayCurrentCategoryId,
    activeForm === "ebay" && !!categoryTreeId
  );
  
  // Categories for General form
  const { data: generalCategoriesData, isLoading: isLoadingGeneralCategories, error: generalCategoriesError } = useEbayCategories(
    categoryTreeId,
    generalCurrentCategoryId,
    (activeForm === "general" || activeForm === "facebook" || activeForm === "mercari") && !!categoryTreeId
  );
  
  // Use the appropriate category data based on active form
  // Facebook and Mercari forms use General category data for consistency
  const categoriesData = (activeForm === "general" || activeForm === "facebook" || activeForm === "mercari") ? generalCategoriesData : ebayCategoriesData;
  const isLoadingCategories = (activeForm === "general" || activeForm === "facebook" || activeForm === "mercari") ? isLoadingGeneralCategories : isLoadingEbayCategories;
  const categoriesError = (activeForm === "general" || activeForm === "facebook" || activeForm === "mercari") ? generalCategoriesError : ebayCategoriesError;
  const currentCategoryPath = (activeForm === "general" || activeForm === "facebook" || activeForm === "mercari") ? generalCategoryPath : selectedCategoryPath;
  
  const categorySubtreeNode = categoriesData?.categorySubtreeNode;
  const currentCategories = categorySubtreeNode?.childCategoryTreeNodes || [];

  // Sort categories alphabetically
  const sortedCategories = [...currentCategories].sort((a, b) => {
    const nameA = a.category?.categoryName || '';
    const nameB = b.category?.categoryName || '';
    return nameA.localeCompare(nameB);
  });

  // eBay shipping defaults storage
  const EBAY_DEFAULTS_KEY = 'ebay-shipping-defaults';
  const loadEbayDefaults = () => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(EBAY_DEFAULTS_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.warn('Failed to load eBay defaults:', error);
      return null;
    }
  };

  const saveEbayDefaults = (defaults) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(EBAY_DEFAULTS_KEY, JSON.stringify(defaults));
      toast({
        title: "Defaults saved",
        description: "Your shipping defaults have been saved and will be applied to new listings.",
      });
    } catch (error) {
      console.warn('Failed to save eBay defaults:', error);
      toast({
        title: "Error",
        description: "Failed to save defaults. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Load defaults on mount
  useEffect(() => {
    const defaults = loadEbayDefaults();
    if (defaults) {
      setTemplateForms((prev) => ({
        ...prev,
        ebay: {
          ...prev.ebay,
          ...defaults,
        },
      }));
    }
  }, []);
  
  const populateTemplates = React.useCallback((item) => {
    const itemId = item?.id;
    
    // First, load any saved form data for this item
    const savedGeneral = loadTemplateFromStorage('general', itemId);
    const savedEbay = loadTemplateFromStorage('ebay', itemId);
    const savedEtsy = loadTemplateFromStorage('etsy', itemId);
    const savedMercari = loadTemplateFromStorage('mercari', itemId);
    const savedFacebook = loadTemplateFromStorage('facebook', itemId);
    
    // Start with initial template state from item
    const initial = createInitialTemplateState(item);
    
    // Merge with saved form data (saved data takes precedence over initial state)
    const merged = {
      general: savedGeneral ? { ...initial.general, ...savedGeneral } : initial.general,
      ebay: savedEbay ? { ...initial.ebay, ...savedEbay } : initial.ebay,
      etsy: savedEtsy ? { ...initial.etsy, ...savedEtsy } : initial.etsy,
      mercari: savedMercari ? { ...initial.mercari, ...savedMercari } : initial.mercari,
      facebook: savedFacebook ? { ...initial.facebook, ...savedFacebook } : initial.facebook,
    };
    
    setTemplateForms(merged);
    setActiveForm("general");
    setSelectedCategoryPath([]);
    setGeneralCategoryPath([]);
    const brand = item?.brand || "";
    if (brand && !POPULAR_BRANDS.includes(brand)) {
      setBrandIsCustom(true);
    } else {
      setBrandIsCustom(false);
    }
  }, []);
  
  // Load saved templates from localStorage - per-item if editing, global templates for new items
  // Note: This runs when item ID changes, but populateTemplates also loads saved data
  // So we'll only use this for cases where we switch items without calling populateTemplates
  useEffect(() => {
    const itemId = currentEditingItemId;
    
    // Skip if we don't have an item ID (new item mode will use global templates via different mechanism)
    if (!itemId) {
      // For new items, load global templates only on initial mount
      if (bulkSelectedItems.length === 0) {
        const savedGeneral = loadTemplateFromStorage('general', null);
        const savedEbay = loadTemplateFromStorage('ebay', null);
        const savedEtsy = loadTemplateFromStorage('etsy', null);
        const savedMercari = loadTemplateFromStorage('mercari', null);
        const savedFacebook = loadTemplateFromStorage('facebook', null);
        
        if (savedGeneral || savedEbay || savedEtsy || savedMercari || savedFacebook) {
          setTemplateForms((prev) => {
            const updated = { ...prev };
            if (savedGeneral) updated.general = { ...prev.general, ...savedGeneral };
            if (savedEbay) updated.ebay = { ...prev.ebay, ...savedEbay };
            if (savedEtsy) updated.etsy = { ...prev.etsy, ...savedEtsy };
            if (savedMercari) updated.mercari = { ...prev.mercari, ...savedMercari };
            if (savedFacebook) updated.facebook = { ...prev.facebook, ...savedFacebook };
            return updated;
          });
        }
      }
      return;
    }
    
    // For existing items, populateTemplates already loads saved data
    // So we don't need to do anything here - populateTemplates handles it
    // This useEffect is mainly for the initial mount case
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEditingItemId, bulkSelectedItems.length]); // Reload when item ID changes
  
  // Initialize template from first item if available
  useEffect(() => {
    if (bulkSelectedItems.length > 0) {
      const primaryItem = bulkSelectedItems[0];
      if (autoSelect) {
        // Auto-select the first item and populate templates
        setCurrentEditingItemId(primaryItem.id);
        populateTemplates(primaryItem);
      } else {
        // Don't auto-select, just set current editing item but don't populate
        setCurrentEditingItemId(primaryItem.id);
        setTemplateForms(createInitialTemplateState(null));
        setBrandIsCustom(false);
        setSelectedCategoryPath([]);
        setGeneralCategoryPath([]);
      }
    } else {
      // New item mode - no items selected
      setCurrentEditingItemId(null);
      setTemplateForms(createInitialTemplateState(null));
      setBrandIsCustom(false);
      setSelectedCategoryPath([]);
      setGeneralCategoryPath([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkSelectedItems.length, autoSelect, itemIds.join(',')]);
  
  const switchToItem = (itemId) => {
    const item = bulkSelectedItems.find(it => it.id === itemId);
    if (item) {
      setCurrentEditingItemId(itemId);
      populateTemplates(item);
      setActiveForm("general");
      setSelectedCategoryPath([]);
      setGeneralCategoryPath([]);
    }
  };
  
  const generalForm = templateForms.general;
  const ebayForm = templateForms.ebay;
  const etsyForm = templateForms.etsy;
  const mercariForm = templateForms.mercari;
  const facebookForm = templateForms.facebook;

  // Find similar items for description generation
  const similarItems = useMemo(() => {
    if (!generalForm.title && !generalForm.brand && !generalForm.category) {
      return [];
    }

    return inventory
      .filter(item => {
        // Exclude current item if editing
        if (currentEditingItemId && item.id === currentEditingItemId) {
          return false;
        }

        // Find items with similar characteristics
        const titleMatch = generalForm.title && item.item_name
          ? item.item_name.toLowerCase().includes(generalForm.title.toLowerCase().split(' ')[0]) ||
            generalForm.title.toLowerCase().includes(item.item_name.toLowerCase().split(' ')[0])
          : false;

        const brandMatch = generalForm.brand && item.brand
          ? item.brand.toLowerCase() === generalForm.brand.toLowerCase()
          : false;

        const categoryMatch = generalForm.category && item.category
          ? item.category.toLowerCase() === generalForm.category.toLowerCase()
          : false;

        return (titleMatch || brandMatch || categoryMatch) && item.notes && item.notes.trim().length > 0;
      })
      .slice(0, 10) // Limit to 10 similar items
      .map(item => item.notes)
      .filter(Boolean);
  }, [inventory, generalForm.title, generalForm.brand, generalForm.category, currentEditingItemId]);

  // Get category aspects (brands, types, etc.) when a final category is selected
  // For eBay form
  // Note: categoryTreeId can be '0' for US marketplace, so only check for null/undefined/loading
  const isValidCategoryTreeId = !isLoadingCategoryTree && categoryTreeId !== null && categoryTreeId !== undefined && String(categoryTreeId).trim() !== '';
  const isValidEbayCategoryId = ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0 && String(ebayForm.categoryId).trim() !== '';
  
  // Log debugging info for aspect fetching (only log when values actually change)
  useEffect(() => {
    if (ebayForm.categoryId && !isLoadingCategoryTree) {
      const validTreeId = categoryTreeId !== null && categoryTreeId !== undefined && String(categoryTreeId).trim() !== '';
      const validCategoryId = ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0 && String(ebayForm.categoryId).trim() !== '';
      const willFetch = validTreeId && validCategoryId;
      
      console.log('🔍 Aspect fetch check:', {
        isLoadingCategoryTree,
        categoryTreeId,
        categoryId: ebayForm.categoryId,
        isValidCategoryTreeId: validTreeId,
        isValidEbayCategoryId: validCategoryId,
        willFetch,
      });
    }
  }, [isLoadingCategoryTree, categoryTreeId, ebayForm.categoryId]); // Removed computed values from deps
  
  // Fetch aspects whenever a category is selected (not just when form is active)
  // This ensures aspects are loaded and ready when user switches to eBay form
  const { data: ebayCategoryAspectsData, isLoading: isLoadingEbayAspects, error: ebayAspectsError } = useEbayCategoryAspects(
    categoryTreeId || null, // Pass null if invalid to prevent API call
    ebayForm.categoryId,
    !!(isValidCategoryTreeId && isValidEbayCategoryId) // Convert to strict boolean
  );

  // For General form - fetch aspects if categoryId is available
  const isValidGeneralCategoryId = generalForm.categoryId && generalForm.categoryId !== '0' && generalForm.categoryId !== 0 && String(generalForm.categoryId).trim() !== '';
  const { data: generalCategoryAspectsData } = useEbayCategoryAspects(
    categoryTreeId,
    generalForm.categoryId,
    !!((activeForm === "general" || activeForm === "etsy" || activeForm === "mercari" || activeForm === "facebook") && isValidCategoryTreeId && isValidGeneralCategoryId) // Convert to strict boolean
  );

  // Use appropriate aspects data based on active form
  const categoryAspects = activeForm === "ebay" 
    ? (ebayCategoryAspectsData?.aspects || [])
    : (generalCategoryAspectsData?.aspects || []);

  // eBay-specific aspects (always use eBay aspects for eBay Category Specifics section)
  // Handle different possible response structures
  const ebayCategoryAspects = (
    ebayCategoryAspectsData?.aspects || 
    ebayCategoryAspectsData?.aspectsForCategory || 
    ebayCategoryAspectsData?.categoryAspects ||
    ebayCategoryAspectsData?.data?.aspects ||
    (Array.isArray(ebayCategoryAspectsData) ? ebayCategoryAspectsData : [])
  ) || [];
  
  // eBay-specific aspect detection
  const ebayBrandAspect = ebayCategoryAspects.find(aspect => 
    aspect.localizedAspectName?.toLowerCase() === 'brand' ||
    aspect.aspectConstraint?.aspectDataType === 'STRING'
  );
  
  // Find Type/Model aspect for eBay - check for various naming patterns
  // eBay can return "Model", "Type", "Model (Type)", "Console Model", etc.
  const ebayTypeAspect = ebayCategoryAspects.find(aspect => {
    // Check multiple possible fields for aspect name
    const aspectName = (
      aspect.localizedAspectName?.toLowerCase() || 
      aspect.aspectName?.toLowerCase() ||
      aspect.name?.toLowerCase() ||
      ''
    ).trim();
    
    if (!aspectName) return false;
    
    // Check for exact matches first (highest priority)
    if (aspectName === 'type' || aspectName === 'model') {
      return true;
    }
    
    // Check for combined names with parentheses
    if (aspectName === 'model (type)' || aspectName === 'type (model)') {
      return true;
    }
    
    // Check if it contains "model" (case-insensitive) - this catches "Console Model", "Video Game Console Model", etc.
    if (aspectName.includes('model')) {
      return true;
    }
    
    // Check if it contains "type" but NOT "model" (to avoid duplicates)
    // This catches categories that only have "Type" aspect
    if (aspectName.includes('type') && !aspectName.includes('model')) {
      return true;
    }
    
    return false;
  });

  // General form aspects (for active form display)
  const brandAspect = categoryAspects.find(aspect => 
    aspect.localizedAspectName?.toLowerCase() === 'brand' ||
    aspect.aspectConstraint?.aspectDataType === 'STRING'
  );
  
  // Find Type/Model aspect - check for various naming patterns
  // eBay can return "Model", "Type", "Model (Type)", etc.
  const typeAspect = categoryAspects.find(aspect => {
    const aspectName = aspect.localizedAspectName?.toLowerCase() || '';
    // Check for exact matches first
    if (aspectName === 'type' || aspectName === 'model') {
      return true;
    }
    // Check for combined names
    if (aspectName.includes('type') && aspectName.includes('model')) {
      return true;
    }
    // Check for variations with parentheses
    if (aspectName === 'model (type)' || aspectName === 'type (model)') {
      return true;
    }
    // Check if it contains "model" (case-insensitive)
    if (aspectName.includes('model')) {
      return true;
    }
    return false;
  });
  
  // Debug logging (remove in production if needed)
  if (ebayForm.categoryId) {
    console.log('eBay Category Aspects Debug:', {
      categoryId: ebayForm.categoryId,
      categoryName: ebayForm.categoryName,
      aspectCount: ebayCategoryAspects.length,
      aspectNames: ebayCategoryAspects.map(a => ({
        localizedAspectName: a.localizedAspectName,
        aspectName: a.aspectName,
        name: a.name,
        fullAspect: a
      })),
      foundTypeAspect: !!ebayTypeAspect,
      typeAspectName: ebayTypeAspect?.localizedAspectName || ebayTypeAspect?.aspectName || ebayTypeAspect?.name,
      typeAspectValues: ebayTypeAspect?.aspectValues?.length || 0,
      typeAspectFull: ebayTypeAspect,
      allAspectsFull: ebayCategoryAspects,
    });
  }
  
  // Check if Type aspect is required or recommended (for eBay)
  const isEbayTypeRequired = ebayTypeAspect?.aspectConstraint?.aspectMode === 'REQUIRED' || 
                             ebayTypeAspect?.aspectConstraint?.aspectMode === 'RECOMMENDED';
  
  // Check if Type aspect is required or recommended (for general form)
  const isTypeRequired = typeAspect?.aspectConstraint?.aspectMode === 'REQUIRED' || 
                         typeAspect?.aspectConstraint?.aspectMode === 'RECOMMENDED';
  
  // Check if category has size-related aspects (use eBay aspects for eBay form)
  const ebaySizeAspect = ebayCategoryAspects.find(aspect => {
    const aspectName = aspect.localizedAspectName?.toLowerCase() || '';
    return aspectName.includes('size') || 
           aspectName.includes('shirt size') || 
           aspectName.includes('shoe size') ||
           aspectName.includes('clothing size') ||
           aspectName.includes('apparel size') ||
           aspectName === 'us size' ||
           aspectName === 'size type';
  });
  
  const sizeAspect = categoryAspects.find(aspect => {
    const aspectName = aspect.localizedAspectName?.toLowerCase() || '';
    return aspectName.includes('size') || 
           aspectName.includes('shirt size') || 
           aspectName.includes('shoe size') ||
           aspectName.includes('clothing size') ||
           aspectName.includes('apparel size') ||
           aspectName === 'us size' ||
           aspectName === 'size type';
  });
  const hasSizeAspect = !!sizeAspect;
  const hasEbaySizeAspect = !!ebaySizeAspect;

  // Find all REQUIRED aspects for eBay (not just Model/Type)
  const ebayRequiredAspects = ebayCategoryAspects.filter(aspect => {
    const constraint = aspect.aspectConstraint;
    const isRequired = constraint?.aspectMode === 'REQUIRED' || constraint?.aspectMode === 'RECOMMENDED';
    // Exclude Brand, Model/Type, Items Included, and blockchain/NFT fields (handled separately or not applicable)
    const aspectName = (aspect.localizedAspectName || aspect.aspectName || aspect.name || '').toLowerCase();
    const isBrand = aspectName === 'brand';
    const isModelOrType = aspectName.includes('model') || aspectName === 'type';
    const isItemsIncluded = aspectName.includes('items included') || aspectName.includes('what\'s included') || aspectName === 'included';
    const isBlockchainField = aspectName.includes('token') || 
                              aspectName.includes('blockchain') || 
                              aspectName.includes('contract address') || 
                              aspectName.includes('creator') ||
                              aspectName.includes('nft') ||
                              aspectName.includes('crypto');
    return isRequired && !isBrand && !isModelOrType && !isItemsIncluded && !isBlockchainField;
  });
  
  // Find "Items Included" aspect specifically (can be required or optional)
  const ebayItemsIncludedAspect = ebayCategoryAspects.find(aspect => {
    const aspectName = (aspect.localizedAspectName || aspect.aspectName || aspect.name || '').toLowerCase();
    return aspectName.includes('items included') || 
           aspectName.includes('what\'s included') || 
           aspectName === 'items included' ||
           aspectName === 'included';
  });
  
  // Check if Items Included is required
  const isItemsIncludedRequired = ebayItemsIncludedAspect?.aspectConstraint?.aspectMode === 'REQUIRED';

  // For General form, also check if category is selected (fallback if aspects not available)
  const generalHasCategory = generalForm.category && generalForm.category.trim() !== '';
  const shouldShowGeneralSize = generalHasCategory && (hasSizeAspect || generalForm.categoryId);

  // For eBay form, require both category and size aspect
  const ebayHasCategory = ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0;
  const shouldShowEbaySize = ebayHasCategory && hasEbaySizeAspect;

  const ebayBrands = ebayBrandAspect?.aspectValues?.map(val => val.localizedValue) || [];
  
  // Extract type values for eBay - handle different possible structures
  let ebayTypeValues = [];
  if (ebayTypeAspect) {
    // Check multiple possible structures for aspect values
    const aspectValues = ebayTypeAspect.aspectValues || 
                        ebayTypeAspect.values || 
                        ebayTypeAspect.value || 
                        [];
    
    if (Array.isArray(aspectValues)) {
      ebayTypeValues = aspectValues.map(val => {
        // Handle different possible structures
        if (typeof val === 'string') {
          return val;
        }
        return val?.localizedValue || val?.value || val?.localizedLabel || val?.label || val;
      }).filter(Boolean).filter(val => val && typeof val === 'string' && val.trim().length > 0);
    } else if (aspectValues) {
      // Single value case
      const singleVal = aspectValues.localizedValue || aspectValues.value || aspectValues.localizedLabel || aspectValues.label || aspectValues;
      if (singleVal && typeof singleVal === 'string' && singleVal.trim().length > 0) {
        ebayTypeValues = [singleVal];
      }
    }
  }
  
  // Extract type values for general form - handle different possible structures
  let typeValues = [];
  if (typeAspect?.aspectValues) {
    typeValues = typeAspect.aspectValues.map(val => {
      // Handle different possible structures
      return val.localizedValue || val.value || val;
    }).filter(Boolean);
  }
  
  // Determine if we should show/require Type field for eBay
  // Show if: category is selected AND (ebayTypeAspect exists OR aspects are still loading)
  const shouldShowEbayType = ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0;
  const shouldRequireEbayType = shouldShowEbayType && (isEbayTypeRequired || ebayTypeAspect);

  const addCustomBrand = (brandName) => {
    const trimmed = brandName.trim();
    if (!trimmed) return;
    
    // Check if brand already exists (case-insensitive)
    const exists = [...POPULAR_BRANDS, ...customBrands].some(
      b => b.toLowerCase() === trimmed.toLowerCase()
    );
    
    if (exists) {
      toast({
        title: "Brand already exists",
        description: `"${trimmed}" is already in your brand list.`,
      });
      return;
    }
    
    const updated = [...customBrands, trimmed];
    setCustomBrands(updated);
    localStorage.setItem('customBrands', JSON.stringify(updated));
    
    toast({
      title: "Custom brand added",
      description: `"${trimmed}" has been added to your brand list.`,
    });
    
    return trimmed;
  };

  const handleSaveShippingDefaults = () => {
    const defaults = {
      handlingTime: ebayForm.handlingTime,
      shippingCost: ebayForm.shippingCost,
      shippingService: ebayForm.shippingService,
      shipFromCountry: ebayForm.shipFromCountry,
      acceptReturns: ebayForm.acceptReturns,
      returnWithin: ebayForm.returnWithin,
      returnShippingPayer: ebayForm.returnShippingPayer,
      returnRefundMethod: ebayForm.returnRefundMethod,
      shippingCostType: ebayForm.shippingCostType,
      shippingMethod: ebayForm.shippingMethod,
    };
    saveEbayDefaults(defaults);
  };
  
  const getColorHex = (colorValue) => {
    if (!colorValue) return null;
    if (colorValue.startsWith("#")) return colorValue;
    const color = COMMON_COLORS.find(c => c.name.toLowerCase() === colorValue.toLowerCase());
    return color ? color.hex : null;
  };
  
  const getColorName = (colorValue) => {
    if (!colorValue) return "Select color";
    if (colorValue.startsWith("#")) {
      const color = COMMON_COLORS.find(c => c.hex.toLowerCase() === colorValue.toLowerCase());
      return color ? color.name : colorValue;
    }
    return colorValue;
  };
  
  const handleColorSelect = (colorName, colorHex) => {
    if (editingColorField) {
      const valueToStore = colorName.startsWith("#") ? colorName : colorName;
      if (editingColorField === "ebay.color") {
        handleMarketplaceChange("ebay", "color", valueToStore);
      } else {
        handleGeneralChange(editingColorField, valueToStore);
      }
      setEditingColorField(null);
      setColorPickerOpen(false);
    }
  };

  // Condition mapping functions
  const mapGeneralConditionToEbay = (generalCondition) => {
    const conditionMap = {
      "New With Tags/Box": "New",
      "New Without Tags/Box": "Open Box",
      "Pre - Owned - Good": "Used",
      "Poor (Major flaws)": "Used",
      // These don't map - user must choose manually on eBay
      "New With Imperfections": null,
      "Pre - Owned - Excellent": null,
      "Pre - Owned - Fair": null,
    };
    return conditionMap[generalCondition] || null;
  };

  const handleEbayItemSelect = (inventoryData) => {
    setTemplateForms((prev) => {
      const updated = { ...prev };
      const general = { ...prev.general };
      
      // Populate general form with eBay item data
      if (inventoryData.item_name) general.title = inventoryData.item_name;
      if (inventoryData.image_url) {
        // Add image as photo
        const photo = {
          id: `ebay-${Date.now()}`,
          preview: inventoryData.image_url,
          fileName: "eBay item image",
          fromInventory: true,
        };
        general.photos = [photo, ...(general.photos || [])];
      }
      if (inventoryData.category) general.category = inventoryData.category;
      if (inventoryData.purchase_price) general.cost = String(inventoryData.purchase_price);
      if (inventoryData.notes) {
        general.description = inventoryData.notes;
      }
      
      updated.general = general;
      return updated;
    });
    setEbaySearchDialogOpen(false);
  };
  
  const openColorPicker = (field) => {
    setEditingColorField(field);
    setColorPickerOpen(true);
  };
  
  const handleGeneralChange = (field, value) => {
    setTemplateForms((prev) => {
      const general = { ...prev.general, [field]: value };
      const next = { ...prev, general };

      // Always sync to all marketplace forms (removed inheritGeneral checks)
      // eBay sync
      next.ebay = { ...next.ebay };
      if (field === "title") next.ebay.title = value;
      if (field === "description") next.ebay.description = value;
      if (field === "photos") next.ebay.photos = value;
      if (field === "price") next.ebay.buyItNowPrice = value;
      if (field === "zip") next.ebay.shippingLocation = value;
      if (field === "category") {
        next.ebay.categoryName = value;
        // Also sync the category path for breadcrumb navigation
        setSelectedCategoryPath([...generalCategoryPath]);
      }
      if (field === "categoryId") {
        next.ebay.categoryId = value;
      }
      if (field === "brand") {
        next.ebay.ebayBrand = value;
        next.ebay.brand = value;
      }
      if (field === "sku") {
        next.ebay.sku = value;
      }
      if (field === "condition") {
        const mappedCondition = mapGeneralConditionToEbay(value);
        if (mappedCondition) {
          next.ebay.condition = mappedCondition;
        }
      }

      // Etsy sync
      next.etsy = { ...next.etsy };
      if (field === "title") next.etsy.title = value;
      if (field === "description") next.etsy.description = value;
      if (field === "photos") next.etsy.photos = value;
      if (field === "tags") next.etsy.tags = value;
      if (field === "sku") next.etsy.sku = value;

      // Mercari sync
      next.mercari = { ...next.mercari };
      if (field === "title") next.mercari.title = value;
      if (field === "description") next.mercari.description = value;
      if (field === "photos") next.mercari.photos = value;
      if (field === "price") {
        next.mercari.shippingPrice = Number(value) >= 100 ? "Free" : "Buyer pays";
      }

      // Facebook sync
      next.facebook = { ...next.facebook };
      if (field === "title") next.facebook.title = value;
      if (field === "description") next.facebook.description = value;
      if (field === "photos") next.facebook.photos = value;
      if (field === "zip") {
        next.facebook.meetUpLocation = value ? `Meet near ${value}` : "";
      }
      if (field === "price") {
        next.facebook.shippingPrice = Number(value) >= 75 ? "Free shipping" : "";
      }

      return next;
    });
  };
  
  const handleMarketplaceChange = (marketplace, field, value) => {
    setTemplateForms((prev) => ({
      ...prev,
      [marketplace]: {
        ...prev[marketplace],
        [field]: value,
      },
    }));
  };
  
  const handleToggleInherit = (marketplace, checked) => {
    setTemplateForms((prev) => {
      const updated = {
        ...prev[marketplace],
        inheritGeneral: checked,
      };

      if (checked) {
        // Copy photos and title from general when inheriting
        updated.photos = prev.general.photos || [];
        updated.title = prev.general.title || "";
        updated.description = prev.general.description || "";
        
        if (marketplace === "ebay") {
          updated.buyItNowPrice = prev.general.price;
          updated.shippingLocation = prev.general.zip;
        }
        if (marketplace === "etsy") {
          updated.tags = prev.general.tags;
        }
        if (marketplace === "mercari") {
          updated.shippingPrice = prev.general.price
            ? Number(prev.general.price) >= 100
              ? "Free"
              : "Buyer pays"
            : "";
        }
        if (marketplace === "facebook") {
          updated.meetUpLocation = prev.general.zip ? `Meet near ${prev.general.zip}` : "";
        }
      }

      return {
        ...prev,
        [marketplace]: updated,
      };
    });
  };
  
  // Template storage keys - use item-specific keys when editing an item, global templates for new items
  const getStorageKey = (templateKey, itemId = null) => {
    if (itemId) {
      return `crosslist-item-${itemId}-${templateKey}`;
    }
    return `crosslist-template-${templateKey}`;
  };

  const saveTemplateToStorage = (templateKey, data, itemId = null) => {
    if (typeof window === 'undefined') return;
    try {
      const key = getStorageKey(templateKey, itemId);
      if (key) {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (error) {
      console.error(`Error saving ${templateKey} template:`, error);
    }
  };

  const loadTemplateFromStorage = (templateKey, itemId = null) => {
    if (typeof window === 'undefined') return null;
    try {
      const key = getStorageKey(templateKey, itemId);
      if (!key) return null;
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.error(`Error loading ${templateKey} template:`, error);
      return null;
    }
  };

  const copyGeneralFieldsToMarketplace = (generalData, marketplaceKey) => {
    const copied = {};
    
    // Copy ALL common fields that all marketplaces can use (even if empty to ensure sync)
    copied.title = generalData.title || "";
    copied.description = generalData.description || "";
    copied.quantity = generalData.quantity || "1";
    copied.photos = generalData.photos || [];
    copied.sku = generalData.sku || "";
    copied.category = generalData.category || "";
    copied.size = generalData.size || "";
    copied.color = generalData.color1 || "";
    copied.brand = generalData.brand || "";
    
    // Handle condition mapping for eBay
    if (marketplaceKey === 'ebay') {
      const mappedCondition = mapGeneralConditionToEbay(generalData.condition || "");
      if (mappedCondition) {
        copied.condition = mappedCondition;
      }
      copied.ebayBrand = generalData.brand || "";
    } else {
      copied.condition = generalData.condition || "";
    }
    
    // Marketplace-specific field mappings
    if (marketplaceKey === 'ebay') {
      copied.buyItNowPrice = generalData.price || "";
      copied.shippingLocation = generalData.zip || "";
      copied.categoryId = generalData.categoryId || "";
      copied.categoryName = generalData.category || "";
      // Sync zip code to eBay shipping location
      if (generalData.zip) {
        copied.shippingLocation = generalData.zip;
      }
    } else if (marketplaceKey === 'etsy') {
      copied.tags = generalData.tags || "";
    } else if (marketplaceKey === 'mercari') {
      copied.shippingPrice = generalData.price
        ? (Number(generalData.price) >= 100 ? "Free" : "Buyer pays")
        : "";
    } else if (marketplaceKey === 'facebook') {
      copied.meetUpLocation = generalData.zip ? `Meet near ${generalData.zip}` : "";
      copied.shippingPrice = generalData.price
        ? (Number(generalData.price) >= 75 ? "Free shipping" : "")
        : "";
    }
    
    return copied;
  };

  const handleReconnect = (templateKey) => {
    if (templateKey === 'ebay') {
      // Initiate eBay OAuth flow
      window.location.href = '/api/ebay/auth';
    } else if (templateKey === 'facebook') {
      // Initiate Facebook OAuth flow
      window.location.href = '/auth/facebook/auth';
    } else {
      const label = TEMPLATE_DISPLAY_NAMES[templateKey] || "Marketplace";
      toast({
        title: `${label} reconnected`,
        description: "We'll refresh the integration and pull the latest account settings.",
      });
    }
  };
  
  const handleDisconnectEbay = () => {
    localStorage.removeItem('ebay_user_token');
    setEbayToken(null);
    toast({
      title: "eBay account disconnected",
      description: "Your eBay account has been disconnected.",
    });
  };
  
  const handleConnectEbay = async () => {
    // Save current theme to sessionStorage before OAuth redirect
    const currentTheme = localStorage.getItem('theme') || 'default-light';
    sessionStorage.setItem('preserved_theme', currentTheme);
    
    // Save current form state before redirecting to OAuth
    const stateToSave = {
      templateForms,
      currentEditingItemId,
      activeForm,
      selectedCategoryPath,
      generalCategoryPath,
      itemIds: itemIds.join(','), // Save as comma-separated string
      autoSelect,
    };
    
    // Save to sessionStorage (cleared when tab closes)
    sessionStorage.setItem('ebay_oauth_state', JSON.stringify(stateToSave));
    
    // First check OAuth configuration
    try {
      const debugResponse = await fetch('/api/ebay/auth?debug=true');
      const debugInfo = await debugResponse.json();
      
      console.log('eBay OAuth Configuration:', debugInfo);
      
      // Proceed with OAuth flow
      window.location.href = '/api/ebay/auth';
    } catch (error) {
      console.error('Error checking eBay OAuth config:', error);
      toast({
        title: "Configuration Error",
        description: "Unable to connect to eBay. Please check the console for details.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectFacebook = () => {
    localStorage.removeItem('facebook_access_token');
    setFacebookToken(null);
    setFacebookPages([]);
    setFacebookSelectedPage(null);
    toast({
      title: "Facebook account disconnected",
      description: "Your Facebook account has been disconnected.",
    });
  };
  
  const handleConnectFacebook = () => {
    // Save current theme to sessionStorage before OAuth redirect
    const currentTheme = localStorage.getItem('theme') || 'default-light';
    sessionStorage.setItem('preserved_theme', currentTheme);
    
    // Save current form state before redirecting to OAuth
    const stateToSave = {
      templateForms,
      currentEditingItemId,
      activeForm,
      selectedCategoryPath,
      generalCategoryPath,
      itemIds: itemIds.join(','), // Save as comma-separated string
      autoSelect,
    };
    
    // Save to sessionStorage (cleared when tab closes)
    sessionStorage.setItem('facebook_oauth_state', JSON.stringify(stateToSave));
    
    // Initiate Facebook OAuth flow
    window.location.href = '/auth/facebook/auth';
  };

  const handleTemplateSave = async (templateKey) => {
    const label = TEMPLATE_DISPLAY_NAMES[templateKey] || "Template";
    const itemId = currentEditingItemId; // Use current item ID if editing an existing item
    
    if (templateKey === 'general') {
      // Save general form (per-item if editing, or as template for new items)
      saveTemplateToStorage('general', generalForm, itemId);
      
      // Always copy general fields to all marketplace forms (auto-sync)
      const updatedForms = { ...templateForms };
      
      // Update eBay form (always sync)
      const ebayUpdates = copyGeneralFieldsToMarketplace(generalForm, 'ebay');
      updatedForms.ebay = { ...updatedForms.ebay, ...ebayUpdates };
      // Also sync the category path state for eBay
      if (generalCategoryPath.length > 0) {
        setSelectedCategoryPath(generalCategoryPath);
      }
      saveTemplateToStorage('ebay', updatedForms.ebay, itemId);
      
      // Update Etsy form (always sync)
      const etsyUpdates = copyGeneralFieldsToMarketplace(generalForm, 'etsy');
      updatedForms.etsy = { ...updatedForms.etsy, ...etsyUpdates };
      saveTemplateToStorage('etsy', updatedForms.etsy, itemId);
      
      // Update Mercari form (always sync)
      const mercariUpdates = copyGeneralFieldsToMarketplace(generalForm, 'mercari');
      updatedForms.mercari = { ...updatedForms.mercari, ...mercariUpdates };
      saveTemplateToStorage('mercari', updatedForms.mercari, itemId);
      
      // Update Facebook form (always sync)
      const facebookUpdates = copyGeneralFieldsToMarketplace(generalForm, 'facebook');
      updatedForms.facebook = { ...updatedForms.facebook, ...facebookUpdates };
      saveTemplateToStorage('facebook', updatedForms.facebook, itemId);
      
      // Update state with copied fields
      setTemplateForms(updatedForms);
      
      // Auto-save to inventory when saving general template
      if (generalForm.title && generalForm.title.trim()) {
        try {
          setIsSaving(true);
          
          // Upload all photos
          const { imageUrl, images } = await uploadAllPhotos(generalForm.photos);

          const customLabels = generalForm.customLabels
            ? generalForm.customLabels.split(',').map(label => label.trim()).filter(Boolean)
            : [];

          const tags = generalForm.tags
            ? generalForm.tags.split(',').map(tag => tag.trim()).filter(Boolean)
            : [];

          const inventoryData = {
            item_name: generalForm.title || "Untitled Item",
            purchase_price: generalForm.cost ? parseFloat(generalForm.cost) : 0,
            listing_price: generalForm.price ? parseFloat(generalForm.price) : 0,
            purchase_date: new Date().toISOString().split('T')[0],
            source: "Crosslist",
            status: "available",
            category: generalForm.category || "",
            quantity: generalForm.quantity ? parseInt(generalForm.quantity, 10) : 1,
            brand: generalForm.brand || "",
            condition: generalForm.condition || "",
            color1: generalForm.color1 || "",
            color2: generalForm.color2 || "",
            color3: generalForm.color3 || "",
            sku: generalForm.sku || "",
            zip_code: generalForm.zip || "",
            size: generalForm.size || "",
            package_details: generalForm.packageDetails || "",
            package_weight: generalForm.packageWeight || "",
            package_length: generalForm.packageLength || "",
            package_width: generalForm.packageWidth || "",
            package_height: generalForm.packageHeight || "",
            custom_labels: generalForm.customLabels || "",
            image_url: imageUrl,
            images: images, // Save all images
            notes: generalForm.description || "",
          };

          let savedItem;
          if (currentEditingItemId) {
            // Update existing inventory item
            savedItem = await base44.entities.InventoryItem.update(currentEditingItemId, inventoryData);
          } else {
            // Create new inventory item
            savedItem = await base44.entities.InventoryItem.create(inventoryData);
          }

          if (savedItem?.id) {
            const allLabels = [...customLabels, ...tags];
            for (const label of allLabels) {
              addTag(savedItem.id, label);
            }
            
            // Update currentEditingItemId so future saves update the same item
            if (!currentEditingItemId) {
              setCurrentEditingItemId(savedItem.id);
            }
          }

          queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });

          toast({
            title: "General template saved",
            description: `Your preferences have been saved, synced to marketplace forms, and the item has been ${currentEditingItemId ? 'updated in' : 'added to'} inventory.`,
            duration: 2000,
          });
        } catch (error) {
          console.error("Error saving item to inventory:", error);
          toast({
            title: "Template saved (inventory save failed)",
            description: "Your preferences have been saved, but there was an error with inventory. You can save it manually later.",
            variant: "destructive",
          });
        } finally {
          setIsSaving(false);
        }
      } else {
        // No title - just show success message
        toast({
          title: "General template saved",
          description: "Your preferences have been saved and automatically synced to all marketplace forms.",
          duration: 2000,
        });
      }
    } else {
      // Save individual marketplace template (per-item if editing, or as template for new items)
      const marketplaceForm = templateForms[templateKey];
      if (marketplaceForm) {
        saveTemplateToStorage(templateKey, marketplaceForm, itemId);
        toast({
          title: `${label} ${itemId ? 'saved' : 'template saved'}`,
          description: itemId 
            ? `Your ${label.toLowerCase()} preferences have been saved for this item.` 
            : "Your preferences will be used the next time you compose a listing.",
        });
      }
    }
  };
  
  const validateEbayForm = () => {
    const errors = [];
    if (!ebayForm.handlingTime) errors.push("Handling Time");
    if (!ebayForm.shippingService) errors.push("Shipping Service");
    if (!ebayForm.shippingCostType) errors.push("Shipping Cost Type");
    if (!ebayForm.shippingMethod) errors.push("Shipping Method");
    if (!ebayForm.pricingFormat) errors.push("Pricing Format");
    if (!ebayForm.duration) errors.push("Duration");
    if (!ebayForm.buyItNowPrice) errors.push("Buy It Now Price");
    if (!ebayForm.color) errors.push("Color");
    
    // Category is validated separately before listing (see finalCategoryId check)
    // Skipping category validation here to avoid false positives with sync issues
    
    // Only require Type if category is selected and ebayTypeAspect exists with values
    if (ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0) {
      // Only require if we have the type aspect with values
      if (ebayTypeAspect && ebayTypeValues.length > 0 && !ebayForm.itemType) {
        errors.push(ebayTypeAspect.localizedAspectName || "Model (Type)");
      }
    }
    if (!ebayForm.condition) errors.push("Condition");
    if (!ebayForm.shippingCost) errors.push("Shipping Cost");
    // Only require return fields when Accept Returns is enabled
    if (ebayForm.acceptReturns) {
      if (!ebayForm.returnWithin) errors.push("Return Within");
      if (!ebayForm.returnShippingPayer) errors.push("Return Shipping Payer");
      if (!ebayForm.returnRefundMethod) errors.push("Return Refund Method");
    }
    if (!generalForm.title) errors.push("Title");
    // Check eBay brand, fallback to general brand
    if (!ebayForm.ebayBrand && !generalForm.brand) {
      errors.push("eBay Brand");
    }
    if (!generalForm.quantity) errors.push("Quantity");
    
    // Check required item specifics
    if (isItemsIncludedRequired && !ebayForm.itemsIncluded) {
      errors.push("Items Included");
    }
    // Check other required custom item specifics
    if (ebayRequiredAspects.length > 0) {
      ebayRequiredAspects.forEach(aspect => {
        const aspectName = (aspect.localizedAspectName || aspect.aspectName || aspect.name || '').toLowerCase().replace(/\s+/g, '_');
        if (!ebayForm.customItemSpecifics?.[aspectName]) {
          errors.push(aspect.localizedAspectName || aspect.aspectName || aspect.name);
        }
      });
    }
    
    return errors;
  };
  
  const handleListOnMarketplace = async (marketplace) => {
    if (marketplace === "ebay") {
      const errors = validateEbayForm();
      if (errors.length > 0) {
        toast({
          title: "Missing required fields",
          description: `Please fill in: ${errors.join(", ")}`,
          variant: "destructive",
        });
        return;
      }

      try {
        setIsSaving(true);

        // Upload any photos with blob: URLs to get proper HTTP/HTTPS URLs for eBay
        const sourcePhotos = ebayForm.photos?.length > 0 ? ebayForm.photos : (generalForm.photos || []);
        const photosToUse = [];
        for (const photo of sourcePhotos) {
          if (photo.file && photo.preview && photo.preview.startsWith('blob:')) {
            // Photo needs to be uploaded
            try {
              const uploadPayload = photo.file instanceof File 
                ? photo.file 
                : new File([photo.file], photo.fileName || 'photo.jpg', { type: photo.file.type || 'image/jpeg' });
              
              const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
              photosToUse.push({
                ...photo,
                preview: file_url,
                imageUrl: file_url,
              });
            } catch (uploadError) {
              console.error('Error uploading photo:', uploadError);
              // Skip this photo if upload fails
              continue;
            }
          } else if (photo.preview && (photo.preview.startsWith('http://') || photo.preview.startsWith('https://'))) {
            // Photo already has a valid URL
            photosToUse.push({
              ...photo,
              imageUrl: photo.preview,
            });
          } else if (photo.imageUrl && (photo.imageUrl.startsWith('http://') || photo.imageUrl.startsWith('https://'))) {
            // Photo has imageUrl field with valid URL
            photosToUse.push(photo);
          }
        }

        if (photosToUse.length === 0 && sourcePhotos.length > 0) {
          throw new Error('No valid photo URLs available. Please ensure photos are uploaded or use photos from inventory.');
        }

        // Get category ID from either form
        const finalCategoryId = ebayForm.categoryId || generalForm.categoryId;
        
        // Validate we have a category (check both ID and name as fallback)
        const hasCategorySet = (finalCategoryId && finalCategoryId !== '0' && finalCategoryId !== 0) || 
                              ebayForm.categoryName || 
                              generalForm.category;
        
        if (!hasCategorySet) {
          throw new Error('Please select a category before listing.');
        }
        
        // If we don't have the ID but have the name, that's an issue with sync
        if ((!finalCategoryId || finalCategoryId === '0') && (ebayForm.categoryName || generalForm.category)) {
          throw new Error('Category name is set but ID is missing. Please reselect the category or contact support.');
        }
        
        // Prepare listing data
        const listingData = {
          title: ebayForm.title || generalForm.title,
          description: ebayForm.description || generalForm.description || '',
          categoryId: finalCategoryId,
          price: ebayForm.buyItNowPrice || generalForm.price,
          quantity: parseInt(generalForm.quantity) || 1,
          photos: photosToUse,
          condition: ebayForm.condition || generalForm.condition || 'New',
          brand: ebayForm.ebayBrand || generalForm.brand || '',
          itemType: ebayForm.itemType || '',
          itemTypeAspectName: ebayTypeAspect?.localizedAspectName || ebayTypeAspect?.aspectName || ebayTypeAspect?.name || 'Model',
          packageWeight: generalForm.packageWeight || '',
          postalCode: generalForm.zip || '',
          shippingMethod: ebayForm.shippingMethod,
          shippingCostType: ebayForm.shippingCostType,
          shippingCost: ebayForm.shippingCost,
          shippingService: ebayForm.shippingService,
          handlingTime: ebayForm.handlingTime,
          shipFromCountry: ebayForm.shipFromCountry || 'United States',
          acceptReturns: ebayForm.acceptReturns,
          returnWithin: ebayForm.returnWithin,
          returnShippingPayer: ebayForm.returnShippingPayer,
          returnRefundMethod: ebayForm.returnRefundMethod,
          duration: ebayForm.duration,
          allowBestOffer: ebayForm.allowBestOffer,
          sku: ebayForm.sku || generalForm.sku || '',
          locationDescriptions: ebayForm.locationDescriptions || '',
          shippingLocation: ebayForm.shippingLocation || generalForm.zip || '',
          itemsIncluded: ebayForm.itemsIncluded || '',
          customItemSpecifics: ebayForm.customItemSpecifics || {},
        };

        // Get user token - check if stored or use from request
        let userToken = null;
        if (ebayToken && ebayToken.access_token) {
          // Check if token is expired
          if (ebayToken.expires_at && ebayToken.expires_at > Date.now()) {
            userToken = ebayToken.access_token;
          } else {
            // Token expired - need to refresh or reconnect
            toast({
              title: "eBay token expired",
              description: "Please reconnect your eBay account to continue.",
              variant: "destructive",
            });
            return;
          }
        }
        
        if (!userToken) {
          toast({
            title: "eBay account not connected",
            description: "Please connect your eBay account before listing items.",
            variant: "destructive",
          });
          return;
        }

        // Call eBay listing API
        const response = await fetch('/api/ebay/listing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: 'AddFixedPriceItem',
            listingData,
            userToken, // Pass user token
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.Ack === 'Success' || result.Ack === 'Warning') {
          const listingItemId = result.ItemID;
          
          // Store listing ID
          if (listingItemId) {
            setEbayListingId(listingItemId);
            // Store in localStorage associated with current item
            if (currentEditingItemId) {
              localStorage.setItem(`ebay_listing_${currentEditingItemId}`, listingItemId);
            }
          }
          
          // Update inventory item status and save marketplace listing
          if (currentEditingItemId && listingItemId) {
            try {
              // Update inventory item status with listing info
              const updatedItem = await base44.entities.InventoryItem.update(currentEditingItemId, {
                status: 'listed',
                ebay_listing_id: String(listingItemId),
                marketplace_listings: {
                  ebay: {
                    listing_id: String(listingItemId),
                    listed_at: new Date().toISOString(),
                    status: 'active',
                    url: result.ListingURL || `https://www.ebay.com/itm/${listingItemId}`
                  }
                }
              });
              
              // Save marketplace listing record to localStorage
              const listingData = {
                inventory_item_id: currentEditingItemId,
                marketplace: 'ebay',
                marketplace_listing_id: String(listingItemId),
                marketplace_listing_url: result.ListingURL || `https://www.ebay.com/itm/${listingItemId}`,
                status: 'active',
                listed_at: new Date().toISOString(),
                metadata: result,
              };
              
              const listings = JSON.parse(localStorage.getItem('marketplace_listings') || '[]');
              listings.push({
                ...listingData,
                id: `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                created_at: new Date().toISOString(),
              });
              localStorage.setItem('marketplace_listings', JSON.stringify(listings));
              
              // Force immediate refresh of inventory data
              await queryClient.invalidateQueries(['inventoryItems']);
              await queryClient.refetchQueries(['inventoryItems']);
              
            } catch (updateError) {
              console.error('Error updating inventory item:', updateError);
              toast({
                title: "Warning",
                description: "Item listed on eBay but inventory update failed. Please refresh the page.",
                variant: "destructive",
              });
            }
          } else if (!currentEditingItemId) {
            toast({
              title: "Warning", 
              description: "Item listed on eBay but not linked to inventory. Save to General form first.",
              variant: "destructive",
            });
          }

          toast({
            title: "Listing created successfully!",
            description: listingItemId ? `eBay Item ID: ${listingItemId}` : "Your item has been listed on eBay.",
          });
        } else {
          throw new Error(result.Errors?.join(', ') || 'Failed to create listing');
        }

      } catch (error) {
        console.error('Error creating eBay listing:', error);
        toast({
          title: "Failed to create listing",
          description: error.message || "An error occurred while creating the listing. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }

      return;
    }

    if (marketplace === "facebook") {
      // Check if Facebook is connected
      if (!isConnected()) {
        toast({
          title: "Facebook Not Connected",
          description: "Please connect your Facebook account in Settings first.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsSaving(true);

        // Upload any photos with blob: URLs to get proper HTTP/HTTPS URLs for Facebook
        const sourcePhotos = facebookForm.photos?.length > 0 ? facebookForm.photos : (generalForm.photos || []);
        const photosToUse = [];
        for (const photo of sourcePhotos) {
          if (photo.file && photo.preview && photo.preview.startsWith('blob:')) {
            // Photo needs to be uploaded
            try {
              const uploadPayload = photo.file instanceof File 
                ? photo.file 
                : new File([photo.file], photo.fileName || 'photo.jpg', { type: photo.file.type || 'image/jpeg' });
              
              const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
              photosToUse.push(file_url);
            } catch (uploadError) {
              console.error('Error uploading photo:', uploadError);
              // Skip this photo if upload fails
              continue;
            }
          } else if (photo.preview && (photo.preview.startsWith('http://') || photo.preview.startsWith('https://'))) {
            // Photo already has a valid URL
            photosToUse.push(photo.preview);
          } else if (photo.imageUrl && (photo.imageUrl.startsWith('http://') || photo.imageUrl.startsWith('https://'))) {
            // Photo has imageUrl field with valid URL
            photosToUse.push(photo.imageUrl);
          }
        }

        if (photosToUse.length === 0) {
          throw new Error('At least one photo is required for Facebook Marketplace listings.');
        }

        // Get user's Facebook pages
        const pages = await getUserPages();
        if (pages.length === 0) {
          throw new Error('No Facebook Pages found. You must manage at least one Page to create Marketplace listings.');
        }

        // Use selected page or first available page
        const pageId = facebookForm.facebookPageId || facebookSelectedPage?.id || pages[0].id;
        const selectedPage = pages.find(p => p.id === pageId) || pages[0];

        // Prepare Facebook listing data
        const title = facebookForm.title || generalForm.title;
        const description = facebookForm.description || generalForm.description || '';
        const price = facebookForm.price || generalForm.price;

        if (!title || !description || !price) {
          throw new Error('Title, description, and price are required for Facebook Marketplace listings.');
        }

        // Convert price to cents
        const priceInCents = Math.round(parseFloat(price) * 100);

        // Create Facebook Marketplace listing
        const result = await createMarketplaceListing({
          pageId: selectedPage.id,
          title: title,
          description: description,
          price: priceInCents,
          currency: 'USD',
          imageUrls: photosToUse,
        });

        if (result.success) {
          toast({
            title: "Facebook listing created successfully!",
            description: result.message || `Your item has been listed on Facebook Marketplace (${selectedPage.name}).`,
          });

          // Update inventory item status and save marketplace listing
          if (currentEditingItemId && result.id) {
            try {
              // Update inventory item status with listing info
              await base44.entities.InventoryItem.update(currentEditingItemId, {
                status: 'listed',
                facebook_listing_id: String(result.id),
                marketplace_listings: {
                  facebook: {
                    listing_id: String(result.id),
                    listed_at: new Date().toISOString(),
                    status: 'active',
                    url: result.url || ''
                  }
                }
              });
              
              // Save marketplace listing record to localStorage
              const listingData = {
                inventory_item_id: currentEditingItemId,
                marketplace: 'facebook',
                marketplace_listing_id: String(result.id),
                marketplace_listing_url: result.url || '',
                status: 'active',
                listed_at: new Date().toISOString(),
                metadata: result,
              };
              
              const listings = JSON.parse(localStorage.getItem('marketplace_listings') || '[]');
              listings.push({
                ...listingData,
                id: `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                created_at: new Date().toISOString(),
              });
              localStorage.setItem('marketplace_listings', JSON.stringify(listings));
              
              // Force immediate refresh of inventory data
              await queryClient.invalidateQueries(['inventoryItems']);
              await queryClient.refetchQueries(['inventoryItems']);
              
            } catch (updateError) {
              console.error('Error updating inventory item:', updateError);
              toast({
                title: "Warning",
                description: "Item listed on Facebook but inventory update failed. Please refresh the page.",
                variant: "destructive",
              });
            }
          }
        } else {
          throw new Error(result.message || 'Failed to create Facebook listing');
        }
      } catch (error) {
        console.error('Error creating Facebook listing:', error);
        toast({
          title: "Failed to create listing",
          description: error.message || "An error occurred while creating the listing. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }

      return;
    }

    if (marketplace === "mercari") {
      try {
        setIsSaving(true);

        // Check if Mercari is connected via extension
        const mercariConnected = localStorage.getItem('profit_orbit_mercari_connected') === 'true';
        
        if (!mercariConnected) {
          toast({
            title: "Mercari Not Connected",
            description: "Please connect your Mercari account in Settings first.",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }

        // Prepare listing data for extension
        const listingData = {
          title: mercariForm.title || generalForm.title,
          description: mercariForm.description || generalForm.description || '',
          price: mercariForm.price || generalForm.price,
          quantity: mercariForm.quantity || generalForm.quantity || 1,
          mercariCategory: mercariForm.mercariCategory || '', // Mercari-specific category
          mercariCategoryId: mercariForm.mercariCategoryId || '', // Mercari category ID
          condition: mercariForm.condition || generalForm.condition,
          brand: mercariForm.brand || generalForm.brand,
          color: mercariForm.color || generalForm.color,
          size: mercariForm.size || generalForm.size,
          photos: mercariForm.photos?.length > 0 ? mercariForm.photos : generalForm.photos || [],
          shipsFrom: mercariForm.shipsFrom || generalForm.zip || '',
          deliveryMethod: mercariForm.deliveryMethod || 'prepaid',
          shippingPayer: mercariForm.shippingCarrier === "Mercari Prepaid" ? "buyer" : "seller",
        };

        // Send to extension for automation
        // The extension will handle the listing in a background tab
        window.postMessage({
          type: 'CREATE_MERCARI_LISTING',
          listingData: listingData
        }, '*');

        toast({
          title: "Creating Mercari Listing...",
          description: "The extension is creating your listing in the background. This may take a few seconds.",
          duration: 5000,
        });

        // Listen for completion message from extension
        const handleListingComplete = (event) => {
          if (event.data.type === 'MERCARI_LISTING_RESPONSE') {
            window.removeEventListener('message', handleListingComplete);
            
            console.log('Received Mercari listing response:', event.data);
            
            if (event.data.success) {
              toast({
                title: "Listed on Mercari!",
                description: (
                  <div>
                    <p>Your item has been listed successfully.</p>
                    {event.data.listingUrl && (
                      <a 
                        href={event.data.listingUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        View Listing →
                      </a>
                    )}
                  </div>
                ),
              });

              // Update inventory item if we have an ID
              if (currentEditingItemId) {
                base44.entities.InventoryItem.update(currentEditingItemId, {
                  status: 'listed',
                  mercari_listing_id: event.data.listingId || '',
                }).catch(err => console.error('Error updating inventory:', err));
              }
            } else {
              toast({
                title: "Listing Failed",
                description: event.data.error || "Failed to create Mercari listing. Please try manually.",
                variant: "destructive",
              });
            }
            
            setIsSaving(false);
          }
        };
        
        window.addEventListener('message', handleListingComplete);
        
        // Timeout after 60 seconds
        setTimeout(() => {
          window.removeEventListener('message', handleListingComplete);
          if (isSaving) {
            setIsSaving(false);
            toast({
              title: "Listing Timeout",
              description: "The listing process took too long. Please check Mercari manually.",
              variant: "destructive",
            });
          }
        }, 60000);

        // Timeout after 30 seconds
        setTimeout(() => {
          window.removeEventListener('message', handleListingComplete);
          setIsSaving(false);
        }, 30000);

      } catch (error) {
        console.error('Error creating Mercari listing:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to create listing.",
          variant: "destructive",
        });
        setIsSaving(false);
      }

      return;
    }

    // For other marketplaces, show coming soon
    toast({
      title: `List on ${TEMPLATE_DISPLAY_NAMES[marketplace] || marketplace}`,
      description: "Listing functionality coming soon!",
    });
  };

  const handleCrosslist = async (marketplaces) => {
    // List on multiple marketplaces
    const marketplacesToUse = marketplaces || ["ebay", "etsy", "mercari", "facebook"];
    const results = [];
    const errors = [];

    setIsSaving(true);

    try {
      // Validate all required forms first
      if (marketplacesToUse.includes("ebay")) {
        const ebayErrors = validateEbayForm();
        if (ebayErrors.length > 0) {
          toast({
            title: "Missing required fields for eBay",
            description: `Please fill in: ${ebayErrors.join(", ")}`,
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
      }

      // List on each marketplace
      for (const marketplace of marketplacesToUse) {
        try {
          if (marketplace === "ebay") {
            // Upload any photos with blob: URLs to get proper HTTP/HTTPS URLs for eBay
            const photosToUse = [];
            for (const photo of generalForm.photos || []) {
              if (photo.file && photo.preview && photo.preview.startsWith('blob:')) {
                // Photo needs to be uploaded
                try {
                  const uploadPayload = photo.file instanceof File 
                    ? photo.file 
                    : new File([photo.file], photo.fileName || 'photo.jpg', { type: photo.file.type || 'image/jpeg' });
                  
                  const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
                  photosToUse.push({
                    ...photo,
                    preview: file_url,
                    imageUrl: file_url,
                  });
                } catch (uploadError) {
                  console.error('Error uploading photo:', uploadError);
                  // Skip this photo if upload fails
                  continue;
                }
              } else if (photo.preview && (photo.preview.startsWith('http://') || photo.preview.startsWith('https://'))) {
                // Photo already has a valid URL
                photosToUse.push({
                  ...photo,
                  imageUrl: photo.preview,
                });
              } else if (photo.imageUrl && (photo.imageUrl.startsWith('http://') || photo.imageUrl.startsWith('https://'))) {
                // Photo has imageUrl field with valid URL
                photosToUse.push(photo);
              }
            }

            if (photosToUse.length === 0 && (generalForm.photos || []).length > 0) {
              throw new Error('No valid photo URLs available. Please ensure photos are uploaded or use photos from inventory.');
            }

            // Prepare eBay listing data
            const listingData = {
              title: generalForm.title,
              description: generalForm.description || '',
              categoryId: ebayForm.categoryId,
              price: ebayForm.buyItNowPrice || generalForm.price,
              quantity: parseInt(generalForm.quantity) || 1,
              photos: photosToUse,
              condition: generalForm.condition || 'new',
              brand: generalForm.brand || ebayForm.ebayBrand || '',
              itemType: ebayForm.itemType || '',
              shippingMethod: ebayForm.shippingMethod,
              shippingCost: ebayForm.shippingCost,
              shippingService: ebayForm.shippingService,
              handlingTime: ebayForm.handlingTime,
              shipFromCountry: ebayForm.shipFromCountry || 'United States',
              acceptReturns: ebayForm.acceptReturns,
              returnWithin: ebayForm.returnWithin,
              returnShippingPayer: ebayForm.returnShippingPayer,
              returnRefundMethod: ebayForm.returnRefundMethod,
              duration: ebayForm.duration,
              allowBestOffer: ebayForm.allowBestOffer,
              sku: generalForm.sku || '',
            };

            const response = await fetch('/api/ebay/listing', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                operation: 'AddFixedPriceItem',
                listingData,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
              throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.Ack === 'Success' || result.Ack === 'Warning') {
              results.push({ marketplace, itemId: result.ItemID });
            } else {
              throw new Error(result.Errors?.join(', ') || 'Failed to create listing');
            }
          } else if (marketplace === "facebook") {
            // Check if Facebook is connected
            if (!isConnected()) {
              throw new Error('Facebook account not connected. Please connect your Facebook account in Settings first.');
            }

            // Upload any photos with blob: URLs to get proper HTTP/HTTPS URLs for Facebook
            const sourcePhotos = facebookForm.photos?.length > 0 ? facebookForm.photos : (generalForm.photos || []);
            const photosToUse = [];
            for (const photo of sourcePhotos) {
              if (photo.file && photo.preview && photo.preview.startsWith('blob:')) {
                // Photo needs to be uploaded
                try {
                  const uploadPayload = photo.file instanceof File 
                    ? photo.file 
                    : new File([photo.file], photo.fileName || 'photo.jpg', { type: photo.file.type || 'image/jpeg' });
                  
                  const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
                  photosToUse.push(file_url);
                } catch (uploadError) {
                  console.error('Error uploading photo:', uploadError);
                  // Skip this photo if upload fails
                  continue;
                }
              } else if (photo.preview && (photo.preview.startsWith('http://') || photo.preview.startsWith('https://'))) {
                // Photo already has a valid URL
                photosToUse.push(photo.preview);
              } else if (photo.imageUrl && (photo.imageUrl.startsWith('http://') || photo.imageUrl.startsWith('https://'))) {
                // Photo has imageUrl field with valid URL
                photosToUse.push(photo.imageUrl);
              }
            }

            if (photosToUse.length === 0) {
              throw new Error('At least one photo is required for Facebook Marketplace listings.');
            }

            // Get user's Facebook pages
            const pages = await getUserPages();
            if (pages.length === 0) {
              throw new Error('No Facebook Pages found. You must manage at least one Page to create Marketplace listings.');
            }

            // Use selected page or first available page
            const pageId = facebookForm.facebookPageId || facebookSelectedPage?.id || pages[0].id;
            const selectedPage = pages.find(p => p.id === pageId) || pages[0];

            // Prepare Facebook listing data
            const title = facebookForm.title || generalForm.title;
            const description = facebookForm.description || generalForm.description || '';
            const price = facebookForm.price || generalForm.price;

            if (!title || !description || !price) {
              throw new Error('Title, description, and price are required for Facebook Marketplace listings.');
            }

            // Convert price to cents
            const priceInCents = Math.round(parseFloat(price) * 100);

            // Create Facebook Marketplace listing
            const result = await createMarketplaceListing({
              pageId: selectedPage.id,
              title: title,
              description: description,
              price: priceInCents,
              currency: 'USD',
              imageUrls: photosToUse,
            });

            if (result.success) {
              results.push({ 
                marketplace, 
                itemId: result.id,
                listingUrl: `https://www.facebook.com/marketplace/item/${result.id}`,
                pageName: selectedPage.name,
              });
            } else {
              throw new Error(result.message || 'Failed to create Facebook listing');
            }
          } else {
            // For other marketplaces, just mark as coming soon for now
            errors.push({ marketplace, error: 'Not yet implemented' });
          }
        } catch (error) {
          console.error(`Error listing on ${marketplace}:`, error);
          errors.push({ marketplace, error: error.message });
        }
      }

      // Update inventory item status if all listings succeeded
      if (results.length > 0 && currentEditingItemId) {
        try {
          await base44.entities.InventoryItem.update(currentEditingItemId, {
            status: 'listed',
          });
          queryClient.invalidateQueries(['inventoryItems']);
        } catch (updateError) {
          console.error('Error updating inventory item:', updateError);
        }
      }

      if (results.length > 0) {
        toast({
          title: "Crosslisted successfully!",
          description: `Listed on ${results.length} marketplace${results.length === 1 ? '' : 's'}: ${results.map(r => r.marketplace).join(', ')}`,
        });
      }

      if (errors.length > 0) {
        toast({
          title: "Some listings failed",
          description: `Failed to list on: ${errors.map(e => e.marketplace).join(', ')}`,
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  const MAX_PHOTOS = 25;
  const MAX_FILE_SIZE_MB = 15;
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  
  // Generic photo upload handler for any marketplace form
  const handlePhotoUpload = async (event, marketplace = 'general') => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingPhotos(true);

    try {
      const formPhotos = marketplace === 'general' 
        ? generalForm.photos 
        : templateForms[marketplace]?.photos || [];
      const currentPhotoCount = formPhotos?.length || 0;
      const remainingSlots = MAX_PHOTOS - currentPhotoCount;
      
      if (remainingSlots <= 0) {
        toast({
          title: "Photo limit reached",
          description: `Maximum ${MAX_PHOTOS} photos allowed. Please remove some photos first.`,
          variant: "destructive",
        });
        return;
      }

      const filesArray = Array.from(files).slice(0, remainingSlots);
      const processedPhotos = [];
      
      for (const file of filesArray) {
        const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
        
        if (file.size > maxSizeBytes) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit. Compressing...`,
          });
        }

        let processedFile = file;
        if (file.size > 1024 * 1024) {
          try {
            processedFile = await imageCompression(file, {
              maxSizeMB: MAX_FILE_SIZE_MB,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
            });
          } catch (error) {
            console.error("Error compressing image:", error);
            toast({
              title: "Compression failed",
              description: `Skipping ${file.name}. Please try a different image.`,
              variant: "destructive",
            });
            continue;
          }
        }

        processedPhotos.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          preview: URL.createObjectURL(processedFile),
          fileName: file.name,
          file: processedFile,
          fromInventory: false,
        });
      }

      if (processedPhotos.length === 0) {
        return;
      }

      setTemplateForms((prev) => {
        const updated = { ...prev };
        if (marketplace === 'general') {
          const newGeneralPhotos = [...(prev.general.photos || []), ...processedPhotos];
          updated.general = {
            ...prev.general,
            photos: newGeneralPhotos,
          };
          // Sync photos to all marketplace forms
          updated.ebay = { ...prev.ebay, photos: newGeneralPhotos };
          updated.etsy = { ...prev.etsy, photos: newGeneralPhotos };
          updated.mercari = { ...prev.mercari, photos: newGeneralPhotos };
          updated.facebook = { ...prev.facebook, photos: newGeneralPhotos };
        } else {
          updated[marketplace] = {
            ...prev[marketplace],
            photos: [...(prev[marketplace]?.photos || []), ...processedPhotos],
          };
        }
        return updated;
      });

      if (processedPhotos.length < filesArray.length) {
        toast({
          title: "Some photos skipped",
          description: `${processedPhotos.length} of ${filesArray.length} photos added.`,
        });
      }

      if (remainingSlots - processedPhotos.length <= 0) {
        toast({
          title: "Photo limit reached",
          description: `You've reached the maximum of ${MAX_PHOTOS} photos.`,
        });
      }
    } catch (error) {
      console.error("Error processing photos:", error);
      toast({
        title: "Upload error",
        description: "Failed to process some photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhotos(false);
      const refMap = {
        'general': photoInputRef,
        'ebay': ebayPhotoInputRef,
        'etsy': etsyPhotoInputRef,
        'mercari': mercariPhotoInputRef,
        'facebook': facebookPhotoInputRef,
      };
      const ref = refMap[marketplace];
      if (ref?.current) {
        ref.current.value = "";
      }
    }
  };
  
  // Generic photo remove handler for any marketplace form
  const handlePhotoRemove = (photoId, marketplace = 'general') => {
    setTemplateForms((prev) => {
      const formPhotos = marketplace === 'general' 
        ? prev.general.photos 
        : prev[marketplace]?.photos || [];
      const targetPhoto = formPhotos.find((photo) => photo.id === photoId);
      if (targetPhoto && !targetPhoto.fromInventory && targetPhoto.preview.startsWith("blob:")) {
        URL.revokeObjectURL(targetPhoto.preview);
      }
      
      const updated = { ...prev };
      if (marketplace === 'general') {
        const newGeneralPhotos = prev.general.photos.filter((photo) => photo.id !== photoId);
        updated.general = {
          ...prev.general,
          photos: newGeneralPhotos,
        };
        // Sync photos to all marketplace forms
        updated.ebay = { ...prev.ebay, photos: newGeneralPhotos };
        updated.etsy = { ...prev.etsy, photos: newGeneralPhotos };
        updated.mercari = { ...prev.mercari, photos: newGeneralPhotos };
        updated.facebook = { ...prev.facebook, photos: newGeneralPhotos };
      } else {
        updated[marketplace] = {
          ...prev[marketplace],
          photos: (prev[marketplace]?.photos || []).filter((photo) => photo.id !== photoId),
        };
      }
      return updated;
    });
  };

  // Generic delete all photos handler for any marketplace form
  const handleDeleteAllPhotos = (marketplace = 'general') => {
    setTemplateForms((prev) => {
      const formPhotos = marketplace === 'general' 
        ? prev.general.photos 
        : prev[marketplace]?.photos || [];
      // Revoke blob URLs for all non-inventory photos
      formPhotos.forEach((photo) => {
        if (!photo.fromInventory && photo.preview.startsWith("blob:")) {
          URL.revokeObjectURL(photo.preview);
        }
      });
      
      const updated = { ...prev };
      if (marketplace === 'general') {
        updated.general = {
          ...prev.general,
          photos: [],
        };
        // Sync empty photos to all marketplace forms
        updated.ebay = { ...prev.ebay, photos: [] };
        updated.etsy = { ...prev.etsy, photos: [] };
        updated.mercari = { ...prev.mercari, photos: [] };
        updated.facebook = { ...prev.facebook, photos: [] };
      } else {
        updated[marketplace] = {
          ...prev[marketplace],
          photos: [],
        };
      }
      return updated;
    });
  };

  const handleSaveEditedImage = async (editedFile) => {
    if (!imageToEdit.photoId || !imageToEdit.marketplace) return;

    try {
      // Create a new preview URL for the edited image
      const newPreview = URL.createObjectURL(editedFile);
      
      // Update the photo in the correct form
      setTemplateForms((prev) => {
        const updated = { ...prev };
        const formPhotos = imageToEdit.marketplace === 'general' 
          ? updated.general.photos 
          : updated[imageToEdit.marketplace]?.photos || [];
        
        const updatedPhotos = formPhotos.map((photo, idx) => {
          if (photo.id === imageToEdit.photoId) {
            return {
              ...photo,
              file: editedFile,
              preview: newPreview,
            };
          }
          return photo;
        });

        if (imageToEdit.marketplace === 'general') {
          updated.general = {
            ...updated.general,
            photos: updatedPhotos,
          };
          // Sync edited photos to all marketplace forms
          updated.ebay = { ...updated.ebay, photos: updatedPhotos };
          updated.etsy = { ...updated.etsy, photos: updatedPhotos };
          updated.mercari = { ...updated.mercari, photos: updatedPhotos };
          updated.facebook = { ...updated.facebook, photos: updatedPhotos };
        } else {
          updated[imageToEdit.marketplace] = {
            ...updated[imageToEdit.marketplace],
            photos: updatedPhotos,
          };
        }

        return updated;
      });

      toast({
        title: "Image Updated",
        description: "The photo has been successfully updated.",
      });
      setEditorOpen(false);
      setImageToEdit({ url: null, photoId: null, marketplace: null, index: null });
    } catch (error) {
      console.error("Error updating image:", error);
      toast({
        title: "Error Updating Image",
        description: "Failed to update the image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleApplyFiltersToAll = async (processedImages, settings) => {
    if (!imageToEdit.marketplace) return;

    try {
      // Update all photos in the current marketplace form with the processed images
      setTemplateForms((prev) => {
        const updated = { ...prev };
        const formPhotos = imageToEdit.marketplace === 'general' 
          ? updated.general.photos 
          : updated[imageToEdit.marketplace]?.photos || [];
        
        // Update each photo with the processed version
        const updatedPhotos = formPhotos.map((photo, idx) => {
          const processedImage = processedImages[idx];
          if (processedImage?.file) {
            return {
              ...photo,
              file: processedImage.file,
              preview: URL.createObjectURL(processedImage.file),
            };
          }
          return photo;
        });

        if (imageToEdit.marketplace === 'general') {
          updated.general = {
            ...updated.general,
            photos: updatedPhotos,
          };
          // Sync filter-applied photos to all marketplace forms
          updated.ebay = { ...updated.ebay, photos: updatedPhotos };
          updated.etsy = { ...updated.etsy, photos: updatedPhotos };
          updated.mercari = { ...updated.mercari, photos: updatedPhotos };
          updated.facebook = { ...updated.facebook, photos: updatedPhotos };
        } else {
          updated[imageToEdit.marketplace] = {
            ...updated[imageToEdit.marketplace],
            photos: updatedPhotos,
          };
        }

        return updated;
      });

      toast({
        title: "Filters Applied to All",
        description: `Successfully applied edits to all ${processedImages.length} images.`,
      });
    } catch (error) {
      console.error("Error applying filters to all:", error);
      toast({
        title: "Error Applying Filters",
        description: "Failed to apply filters to all images. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePhotoReorder = (dragIndex, dropIndex, marketplace = 'general') => {
    setTemplateForms((prev) => {
      const photos = marketplace === 'general'
        ? [...prev.general.photos]
        : [...(prev[marketplace]?.photos || [])];
      const [draggedPhoto] = photos.splice(dragIndex, 1);
      photos.splice(dropIndex, 0, draggedPhoto);
      
      if (marketplace === 'general') {
        return {
          ...prev,
          general: {
            ...prev.general,
            photos,
          },
          // Sync reordered photos to all marketplace forms
          ebay: { ...prev.ebay, photos },
          etsy: { ...prev.etsy, photos },
          mercari: { ...prev.mercari, photos },
          facebook: { ...prev.facebook, photos },
        };
      } else {
        return {
          ...prev,
          [marketplace]: {
            ...prev[marketplace],
            photos,
          },
        };
      }
    });
  };
  
  // Helper function to upload all photos and return images array
  const uploadAllPhotos = async (photos) => {
    if (!photos || photos.length === 0) return { imageUrl: "", images: [] };

    const uploadedImageUrls = [];
    let mainImageUrl = "";

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      let imageUrl = "";

      if (photo.file) {
        const uploadPayload = photo.file instanceof File 
          ? photo.file 
          : new File([photo.file], photo.fileName || `photo_${i}.jpg`, { type: photo.file.type || 'image/jpeg' });
        
        const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
        imageUrl = file_url;
      } else if (photo.preview && !photo.preview.startsWith('blob:')) {
        imageUrl = photo.preview;
      } else if (photo.imageUrl) {
        imageUrl = photo.imageUrl;
      } else if (photo.url) {
        imageUrl = photo.url;
      }

      if (imageUrl) {
        if (i === 0) {
          mainImageUrl = imageUrl; // First photo is main
        }
        uploadedImageUrls.push(imageUrl); // Just push the URL string
      }
    }

    return { imageUrl: mainImageUrl, images: uploadedImageUrls };
  };

  const handleSaveToInventory = async () => {
    setIsSaving(true);
    try {
      // Upload all photos
      const { imageUrl, images } = await uploadAllPhotos(generalForm.photos);

      const customLabels = generalForm.customLabels
        ? generalForm.customLabels.split(',').map(label => label.trim()).filter(Boolean)
        : [];

      const tags = generalForm.tags
        ? generalForm.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : [];

      const inventoryData = {
        item_name: generalForm.title || "Untitled Item",
        purchase_price: generalForm.cost ? parseFloat(generalForm.cost) : 0,
        listing_price: generalForm.price ? parseFloat(generalForm.price) : 0,
        purchase_date: new Date().toISOString().split('T')[0],
        source: "Crosslist",
        status: "available",
        category: generalForm.category || "",
        quantity: generalForm.quantity ? parseInt(generalForm.quantity, 10) : 1,
        brand: generalForm.brand || "",
        condition: generalForm.condition || "",
        color1: generalForm.color1 || "",
        color2: generalForm.color2 || "",
        color3: generalForm.color3 || "",
        sku: generalForm.sku || "",
        zip_code: generalForm.zip || "",
        size: generalForm.size || "",
        package_details: generalForm.packageDetails || "",
        package_weight: generalForm.packageWeight || "",
        package_length: generalForm.packageLength || "",
        package_width: generalForm.packageWidth || "",
        package_height: generalForm.packageHeight || "",
        custom_labels: generalForm.customLabels || "",
        image_url: imageUrl,
        images: images, // Save all images
        notes: generalForm.description || "",
      };

      let savedItem;
      if (currentEditingItemId) {
        // Update existing item
        savedItem = await base44.entities.InventoryItem.update(currentEditingItemId, inventoryData);
      } else {
        // Create new item
        savedItem = await base44.entities.InventoryItem.create(inventoryData);
      }

      if (savedItem?.id) {
        const allLabels = [...customLabels, ...tags];
        for (const label of allLabels) {
          addTag(savedItem.id, label);
        }
        
        // Update currentEditingItemId for future saves
        if (!currentEditingItemId) {
          setCurrentEditingItemId(savedItem.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });

      toast({
        title: "Item saved to inventory",
        description: `${generalForm.title || "Item"} has been ${currentEditingItemId ? 'updated in' : 'added to'} your inventory.`,
      });

      navigate(createPageUrl("Crosslist"));
    } catch (error) {
      console.error("Error saving inventory item:", error);
      toast({
        title: "Failed to save item",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-6 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl("Crosslist"))}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Crosslist
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {bulkSelectedItems.length > 1 ? "Bulk Crosslist" : "Compose Listing"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {bulkSelectedItems.length > 1
                ? `Editing ${bulkSelectedItems.length} items. Select an item to configure its listing.`
                : "Choose marketplaces and set the base fields. Full per-market fine-tuning can follow."}
            </p>
          </div>
        </div>

        {/* eBay Account Connection Section - At Top (Only show on eBay form) */}
        {activeForm === "ebay" && (
        <div className="rounded-lg border border-muted-foreground/30 bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={EBAY_ICON_URL} alt="eBay" className="w-5 h-5" />
              <Label className="text-base font-semibold">eBay Account</Label>
            </div>
            {ebayToken ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("ebay")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={handleDisconnectEbay}>
                  <X className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="default" size="sm" className="gap-2" onClick={handleConnectEbay}>
                <Check className="h-4 w-4" />
                Connect eBay Account
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
            {/* Status */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Status</Label>
              <div className="flex items-center gap-2">
                {ebayToken ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">Not Connected</span>
                  </>
                )}
              </div>
            </div>

            {/* Token Expires */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Token Expires</Label>
              <div className="text-sm">
                {ebayToken?.expires_at ? (
                  <span>{new Date(ebayToken.expires_at).toLocaleDateString()}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>

            {/* eBay Account (Username) */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">eBay Account</Label>
              <div className="text-sm">
                {ebayUsername ? (
                  <span className="font-medium">{ebayUsername}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Facebook Account Connection Section - At Top (Only show on Facebook form) */}
        {activeForm === "facebook" && (
        <div className="rounded-lg border border-muted-foreground/30 bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={FACEBOOK_ICON_URL} alt="Facebook" className="w-5 h-5" />
              <Label className="text-base font-semibold">Facebook Account</Label>
            </div>
            {facebookToken ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("facebook")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={handleDisconnectFacebook}>
                  <X className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="default" size="sm" className="gap-2" onClick={handleConnectFacebook}>
                <Check className="h-4 w-4" />
                Connect Facebook Account
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
            {/* Status */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Status</Label>
              <div className="flex items-center gap-2">
                {facebookToken ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">Not Connected</span>
                  </>
                )}
              </div>
            </div>

            {/* Token Expires */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Token Expires</Label>
              <div className="text-sm">
                {facebookToken?.expires_at ? (
                  <span>{new Date(facebookToken.expires_at).toLocaleDateString()}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>

            {/* Facebook Pages */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Available Pages</Label>
              <div className="text-sm">
                {facebookPages.length > 0 ? (
                  <span className="font-medium">{facebookPages.length} page{facebookPages.length !== 1 ? 's' : ''}</span>
                ) : facebookToken ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Show selected page if available */}
          {facebookPages.length > 0 && (
            <div className="pt-2 border-t">
              <Label className="text-xs text-muted-foreground mb-2 block">Selected Page</Label>
              <Select
                value={facebookSelectedPage?.id || ""}
                onValueChange={(value) => {
                  const page = facebookPages.find(p => p.id === value);
                  setFacebookSelectedPage(page);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a page">
                    {facebookSelectedPage?.name || "Select a page"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {facebookPages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Listings will be posted on behalf of this page.
              </p>
            </div>
          )}
        </div>
        )}

        {/* Bulk item selector */}
        {bulkSelectedItems.length > 1 && (
          <div className="space-y-3">
            <Label className="text-xs mb-1.5 block">Select Item to Edit</Label>
            <div className="flex flex-wrap gap-2">
              {bulkSelectedItems.map((item) => {
                const isCurrent = currentEditingItemId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchToItem(item.id)}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                      isCurrent
                        ? "border-primary bg-primary/10 ring-2 ring-primary"
                        : "border-muted-foreground/40 hover:border-primary/50 bg-muted/30"
                    }`}
                  >
                    <img
                      src={item.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                      alt={item.item_name}
                      className="w-16 h-16 rounded-md object-cover"
                    />
                    <span className={`text-xs text-center max-w-[80px] truncate ${
                      isCurrent ? "font-semibold text-primary" : "text-muted-foreground"
                    }`}>
                      {item.item_name}
                    </span>
                    {isCurrent && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {currentEditingItemId && (
              <Alert className="bg-primary/10 border-primary/20">
                <AlertDescription className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-primary">
                    You are currently editing: {bulkSelectedItems.find(item => item.id === currentEditingItemId)?.item_name || "Unknown Item"}
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Form selector */}
        <div>
          <Label className="text-xs mb-1.5 block">Select Form</Label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveForm("general")}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm transition
                ${activeForm === "general"
                  ? "bg-foreground text-background dark:bg-foreground dark:text-background"
                  : "bg-muted/70 hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/60 text-foreground"
                }`}
            >
              General
            </button>
            {MARKETPLACES.map((m) => {
              const active = activeForm === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveForm(m.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm transition
                    ${active
                      ? "bg-foreground text-background dark:bg-foreground dark:text-background"
                      : "bg-muted/70 hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/60 text-foreground"
                    }`}
                >
                  {renderMarketplaceIcon(m)}
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Select a form to configure. General form data syncs to all marketplace-specific forms.
          </p>
        </div>

        {/* Form Content */}
        <div className="mt-6 space-y-6">
          {/* General Form */}
          {activeForm === "general" && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                  {generalForm.photos && generalForm.photos.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteAllPhotos}
                      className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Delete All
                    </Button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                  {/* Main Photo - spans 2 columns and 2 rows */}
                  {generalForm.photos.length > 0 && (
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", "0");
                        e.currentTarget.classList.add("opacity-50");
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.classList.remove("opacity-50");
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                        const dropIndex = 0;
                        if (dragIndex !== dropIndex) {
                          handlePhotoReorder(dragIndex, dropIndex);
                        }
                        e.currentTarget.classList.remove("opacity-50");
                      }}
                      className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                    >
                      <img src={generalForm.photos[0].preview} alt={generalForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                      <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                        Main
                      </div>
                      <div className="absolute top-1 right-1 flex gap-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageToEdit({ 
                              url: generalForm.photos[0].preview, 
                              photoId: generalForm.photos[0].id, 
                              marketplace: 'general',
                              index: 0
                            });
                            setEditorOpen(true);
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/80 text-white hover:bg-blue-700/90"
                          title="Edit photo"
                        >
                          <ImageIcon className="h-3 w-3" />
                          <span className="sr-only">Edit photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(generalForm.photos[0].id);
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Other Photos */}
                  {generalForm.photos.slice(1).map((photo, index) => (
                    <div
                      key={photo.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(index + 1));
                        e.currentTarget.classList.add("opacity-50");
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.classList.remove("opacity-50");
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                        const dropIndex = index + 1;
                        if (dragIndex !== dropIndex) {
                          handlePhotoReorder(dragIndex, dropIndex);
                        }
                        e.currentTarget.classList.remove("opacity-50");
                      }}
                      className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                    >
                      <img src={photo.preview} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                      <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                        <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                      </div>
                      <div className="absolute top-1 right-1 flex gap-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageToEdit({ 
                              url: photo.preview, 
                              photoId: photo.id, 
                              marketplace: 'general',
                              index: index + 1
                            });
                            setEditorOpen(true);
                          }}
                          className="inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-blue-600/80 text-white hover:bg-blue-700/90"
                          title="Edit photo"
                        >
                          <ImageIcon className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          <span className="sr-only">Edit photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id);
                          }}
                          className="inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Add Photo Button - same size as photo tiles */}
                  {(generalForm.photos?.length || 0) < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhotos}
                      className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                    >
                      <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                      <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                    </button>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {generalForm.photos?.length || 0}/{MAX_PHOTOS} used.
                  {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                </p>
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label htmlFor="general-title" className="text-xs mb-1.5 block">Title</Label>
                  <div className="flex gap-2">
                    <Input
                      id="general-title"
                      name="general-title"
                      placeholder=""
                      value={generalForm.title || ""}
                      onChange={(e) => handleGeneralChange("title", e.target.value)}
                      className="w-full"
                    />
                    {generalForm.title?.trim() && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSoldDialogOpen(true);
                        }}
                        className="whitespace-nowrap"
                      >
                        <BarChart className="w-4 h-4 mr-2" />
                        Search
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="general-price" className="text-xs mb-1.5 block">Listing Price</Label>
                  <Input
                    id="general-price"
                    name="general-price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={generalForm.price || ""}
                    onChange={(e) => handleGeneralChange("price", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Price you'll list this item for</p>
                </div>
                <div>
                  <Label htmlFor="general-cost" className="text-xs mb-1.5 block">Purchase Price</Label>
                  <Input
                    id="general-cost"
                    name="general-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={generalForm.cost || ""}
                    onChange={(e) => handleGeneralChange("cost", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="general-description" className="text-xs">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <RichTextarea
                    id="general-description"
                    name="general-description"
                    placeholder="Enter a detailed description of your item..."
                    value={generalForm.description || ""}
                    onChange={(e) => handleGeneralChange("description", e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>
                <div>
                  <Label htmlFor="general-brand" className="text-xs mb-1.5 block">Brand</Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        id="general-brand"
                        name="general-brand"
                        placeholder="Enter brand name and press Enter to save"
                        value={generalForm.brand || ""}
                        onChange={(e) => handleGeneralChange("brand", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && generalForm.brand?.trim()) {
                            e.preventDefault();
                            const savedBrand = addCustomBrand(generalForm.brand);
                            if (savedBrand) {
                              setBrandIsCustom(false);
                            }
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => {
                          if (generalForm.brand?.trim()) {
                            const savedBrand = addCustomBrand(generalForm.brand);
                            if (savedBrand) {
                              setBrandIsCustom(false);
                            }
                          }
                        }}
                        disabled={!generalForm.brand?.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrandIsCustom(false);
                          handleGeneralChange("brand", "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Popover open={brandSearchOpen} onOpenChange={setBrandSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={brandSearchOpen}
                          className="w-full justify-between"
                        >
                          {generalForm.brand
                            ? POPULAR_BRANDS.find((brand) => brand === generalForm.brand) || generalForm.brand
                            : "Search brand..."}
                          <ArrowRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search brand..." />
                          <CommandList>
                            <CommandEmpty>No brand found.</CommandEmpty>
                            <CommandGroup>
                              {POPULAR_BRANDS.map((brand) => (
                                <CommandItem
                                  key={brand}
                                  value={brand}
                                  onSelect={() => {
                                    handleGeneralChange("brand", brand);
                                    setBrandSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      generalForm.brand === brand ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {brand}
                                </CommandItem>
                              ))}
                              <CommandItem
                                value="custom"
                                onSelect={() => {
                                  setBrandIsCustom(true);
                                  setBrandSearchOpen(false);
                                  handleGeneralChange("brand", "");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    "opacity-0"
                                  )}
                                />
                                Add Custom...
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div>
                  <Label htmlFor="general-condition" className="text-xs mb-1.5 block">Condition</Label>
                  <Select
                    value={generalForm.condition ? String(generalForm.condition) : undefined}
                    onValueChange={(value) => {
                      handleGeneralChange("condition", value);
                      // Map condition to eBay form
                      const ebayCondition = mapGeneralConditionToEbay(value);
                      if (ebayCondition) {
                        handleMarketplaceChange("ebay", "condition", ebayCondition);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New With Tags/Box">New With Tags/Box</SelectItem>
                      <SelectItem value="New Without Tags/Box">New Without Tags/Box</SelectItem>
                      <SelectItem value="New With Imperfections">New With Imperfections</SelectItem>
                      <SelectItem value="Pre - Owned - Excellent">Pre - Owned - Excellent</SelectItem>
                      <SelectItem value="Pre - Owned - Good">Pre - Owned - Good</SelectItem>
                      <SelectItem value="Pre - Owned - Fair">Pre - Owned - Fair</SelectItem>
                      <SelectItem value="Poor (Major flaws)">Poor (Major flaws)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="general-sku" className="text-xs mb-1.5 block">SKU</Label>
                  <Input
                    id="general-sku"
                    name="general-sku"
                    placeholder=""
                    value={generalForm.sku || ""}
                    onChange={(e) => handleGeneralChange("sku", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Primary Color</Label>
                  <Button
                    type="button"
                    variant={generalForm.color1 ? "default" : "outline"}
                    onClick={() => openColorPicker("color1")}
                    className="w-full justify-start"
                  >
                    {generalForm.color1 ? (
                      <>
                        <div
                          className="w-4 h-4 mr-2 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0"
                          style={{ backgroundColor: getColorHex(generalForm.color1) || "#808080" }}
                        />
                        <span className="flex-1 text-left">{getColorName(generalForm.color1)}</span>
                      </>
                    ) : (
                      <>
                        <Palette className="w-4 h-4 mr-2" />
                        <span>Select color</span>
                      </>
                    )}
                  </Button>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Secondary Color</Label>
                  <Button
                    type="button"
                    variant={generalForm.color2 ? "default" : "outline"}
                    onClick={() => openColorPicker("color2")}
                    className="w-full justify-start"
                  >
                    {generalForm.color2 ? (
                      <>
                        <div
                          className="w-4 h-4 mr-2 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0"
                          style={{ backgroundColor: getColorHex(generalForm.color2) || "#808080" }}
                        />
                        <span className="flex-1 text-left">{getColorName(generalForm.color2)}</span>
                      </>
                    ) : (
                      <>
                        <Palette className="w-4 h-4 mr-2" />
                        <span>Select color</span>
                      </>
                    )}
                  </Button>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Category</Label>
                  
                  {/* Breadcrumb navigation for category path */}
                  {generalCategoryPath.length > 0 && (
                    <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => {
                          setGeneralCategoryPath([]);
                          handleGeneralChange("category", "");
                          handleGeneralChange("categoryId", "");
                        }}
                        className="hover:text-foreground underline"
                      >
                        Home
                      </button>
                      {generalCategoryPath.map((cat, index) => (
                        <React.Fragment key={cat.categoryId}>
                          <span>/</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newPath = generalCategoryPath.slice(0, index + 1);
                              setGeneralCategoryPath(newPath);
                              const lastCat = newPath[newPath.length - 1];
                              const fullPath = newPath.map(c => c.categoryName).join(" > ");
                              handleGeneralChange("category", fullPath);
                              if (lastCat?.categoryId) {
                                handleGeneralChange("categoryId", lastCat.categoryId);
                              }
                            }}
                            className="hover:text-foreground underline"
                          >
                            {cat.categoryName}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                  
                  {isLoadingCategoryTree || isLoadingCategories ? (
                    <div className="flex items-center gap-2 p-3 border rounded-md">
                      <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Loading categories...</span>
                    </div>
                  ) : categoriesError ? (
                    <div className="p-3 border rounded-md border-destructive/50 bg-destructive/10">
                      <p className="text-sm text-destructive">Error loading categories: {categoriesError.message}</p>
                      {categoriesError?.response?.details && (
                        <p className="text-xs text-destructive mt-2">
                          Details: {JSON.stringify(categoriesError.response.details)}
                        </p>
                      )}
                    </div>
                  ) : sortedCategories.length > 0 ? (
                    <Select
                      value={undefined}
                      onValueChange={(value) => {
                        const selectedCategory = sortedCategories.find(
                          cat => cat.category?.categoryId === value
                        );
                        
                        if (selectedCategory) {
                          const category = selectedCategory.category;
                          const newPath = [...generalCategoryPath, {
                            categoryId: category.categoryId,
                            categoryName: category.categoryName,
                          }];
                          
                          // Check if this category has children
                          const hasChildren = selectedCategory.childCategoryTreeNodes && 
                            selectedCategory.childCategoryTreeNodes.length > 0 &&
                            !selectedCategory.leafCategoryTreeNode;
                          
                          if (hasChildren) {
                            // Navigate deeper into the tree
                            setGeneralCategoryPath(newPath);
                          } else {
                            // This is a leaf node - select it
                            const fullPath = newPath.map(c => c.categoryName).join(" > ");
                            const categoryId = category.categoryId;
                            handleGeneralChange("category", fullPath);
                            handleGeneralChange("categoryId", categoryId);
                            setGeneralCategoryPath(newPath);
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalCategoryPath.length > 0 ? "Select subcategory" : "Select a category"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {sortedCategories.map((categoryNode) => {
                          const category = categoryNode.category;
                          if (!category || !category.categoryId) return null;
                          
                          const hasChildren = categoryNode.childCategoryTreeNodes && 
                            categoryNode.childCategoryTreeNodes.length > 0 &&
                            !categoryNode.leafCategoryTreeNode;
                          
                          return (
                            <SelectItem key={category.categoryId} value={category.categoryId}>
                              <div className="flex items-center gap-2">
                                <span>{category.categoryName}</span>
                                {hasChildren && (
                                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 border rounded-md">
                      <p className="text-sm text-muted-foreground">No subcategories available.</p>
                    </div>
                  )}
                  
                  {generalForm.category && (
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        Selected: {generalForm.category}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleGeneralChange("category", "");
                          handleGeneralChange("categoryId", "");
                          setGeneralCategoryPath([]);
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* US Size - Only show when category is selected and has size aspect */}
                {shouldShowGeneralSize && (
                  <div>
                    <Label className="text-xs mb-1.5 block">US Size</Label>
                    <Input
                      placeholder="e.g. Men's M, 10, XL"
                      value={generalForm.size}
                      onChange={(e) => handleGeneralChange("size", e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Shipping Settings Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Shipping Settings</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label htmlFor="general-zip" className="text-xs mb-1.5 block">Zip Code</Label>
                  <Input
                    id="general-zip"
                    name="general-zip"
                    placeholder="Enter Zip Code"
                    value={generalForm.zip || ""}
                    onChange={(e) => handleGeneralChange("zip", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={generalForm.quantity}
                    onChange={(e) => handleGeneralChange("quantity", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Tags</Label>
                  <TagInput
                    placeholder="Type keywords and press space or comma to add tags (used for Mercari and Facebook)"
                    value={generalForm.tags}
                    onChange={(value) => handleGeneralChange("tags", value)}
                  />
                </div>
              </div>

              {/* Package Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Package Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Package Details <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant={generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight ? "default" : "outline"}
                    onClick={() => setPackageDetailsDialogOpen(true)}
                    className="w-full justify-start"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight
                      ? `${generalForm.packageWeight} lbs • ${generalForm.packageLength}" × ${generalForm.packageWidth}" × ${generalForm.packageHeight}"`
                      : "Enter weight & size"}
                  </Button>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Custom Labels</Label>
                  <Input
                    placeholder="Comma-separated labels (e.g. Q4 Liquidation, Holiday Gift). These will appear as tags in inventory."
                    value={generalForm.customLabels}
                    onChange={(e) => handleGeneralChange("customLabels", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Custom labels will be saved as tags in your inventory page
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("general")}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* eBay Form */}
          {activeForm === "ebay" && (
            <div className="space-y-6">
              {currentEditingItemId && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Item ID:</span>
                  <span className="text-sm text-muted-foreground font-mono">{currentEditingItemId}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">eBay listing specifics</h3>
                  <p className="text-sm text-muted-foreground">
                    Media, title, description, and pricing inherit from your General template.
                  </p>
                </div>
              </div>

              {/* Photos Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                  {(ebayForm.photos?.length > 0) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAllPhotos('ebay')}
                      className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Delete All
                    </Button>
                  )}
                </div>
                  <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {/* Main Photo - spans 2 columns and 2 rows */}
                    {ebayForm.photos?.length > 0 && (
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", "0");
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = 0;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'ebay');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                      >
                        <img src={ebayForm.photos[0].preview || ebayForm.photos[0].imageUrl} alt={ebayForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                          Main
                        </div>
                        <div className="absolute top-1 right-1 flex gap-1 z-10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageToEdit({ 
                                url: ebayForm.photos[0].preview || ebayForm.photos[0].imageUrl, 
                                photoId: ebayForm.photos[0].id, 
                                marketplace: 'ebay',
                                index: 0
                              });
                              setEditorOpen(true);
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/80 text-white hover:bg-blue-700/90"
                            title="Edit photo"
                          >
                            <ImageIcon className="h-3 w-3" />
                            <span className="sr-only">Edit photo</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePhotoRemove(ebayForm.photos[0].id, 'ebay');
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span className="sr-only">Remove photo</span>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Other Photos */}
                    {ebayForm.photos?.slice(1).map((photo, index) => (
                      <div
                        key={photo.id || index + 1}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(index + 1));
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = index + 1;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'ebay');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                          <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                        </div>
                      <div className="absolute top-1 right-1 flex gap-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageToEdit({ 
                              url: photo.preview || photo.imageUrl, 
                              photoId: photo.id, 
                              marketplace: 'ebay',
                              index: index + 1
                            });
                            setEditorOpen(true);
                          }}
                          className="inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-blue-600/80 text-white hover:bg-blue-700/90"
                          title="Edit photo"
                        >
                          <ImageIcon className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          <span className="sr-only">Edit photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id, 'ebay');
                          }}
                          className="inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                      </div>
                    ))}
                    
                    {/* Add Photo Button - same size as photo tiles */}
                    {(ebayForm.photos?.length || 0) < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => ebayPhotoInputRef.current?.click()}
                        disabled={isUploadingPhotos}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                      >
                        <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                        <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                      </button>
                    )}
                    <input
                      ref={ebayPhotoInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'ebay')}
                    />
                  </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {ebayForm.photos?.length || 0}/{MAX_PHOTOS} used.
                  {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                </p>
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Title Section */}
                <div>
                  <Label htmlFor="ebay-title" className="text-xs mb-1.5 block">Title</Label>
                  <Input
                    id="ebay-title"
                    name="ebay-title"
                    placeholder="Enter listing title"
                    value={ebayForm.title || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "title", e.target.value)}
                  />
                </div>

                {/* Description Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-description" className="text-xs">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <RichTextarea
                    id="ebay-description"
                    name="ebay-description"
                    placeholder={generalForm.description ? `Inherited from General` : "Enter eBay-specific description..."}
                    value={ebayForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "description", e.target.value)}
                    className="min-h-[120px]"
                  />
                  {generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* eBay Brand - use same dropdown as general form */}
                <div className="md:col-span-2">
                  <Label htmlFor="ebay-brand" className="text-xs mb-1.5 block">Brand <span className="text-red-500">*</span></Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        id="ebay-brand"
                        name="ebay-brand"
                        placeholder="Enter brand name and press Enter to save"
                        value={ebayForm.ebayBrand || ""}
                        onChange={(e) => handleMarketplaceChange("ebay", "ebayBrand", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && ebayForm.ebayBrand?.trim()) {
                            e.preventDefault();
                            const savedBrand = addCustomBrand(ebayForm.ebayBrand);
                            if (savedBrand) {
                              setBrandIsCustom(false);
                            }
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => {
                          if (ebayForm.ebayBrand?.trim()) {
                            const savedBrand = addCustomBrand(ebayForm.ebayBrand);
                            if (savedBrand) {
                              setBrandIsCustom(false);
                            }
                          }
                        }}
                        disabled={!ebayForm.ebayBrand?.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrandIsCustom(false);
                          handleMarketplaceChange("ebay", "ebayBrand", "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={ebayForm.ebayBrand || generalForm.brand ? String(ebayForm.ebayBrand || generalForm.brand) : undefined}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          setBrandIsCustom(true);
                          handleMarketplaceChange("ebay", "ebayBrand", "");
                        } else {
                          handleMarketplaceChange("ebay", "ebayBrand", value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalForm.brand ? `Inherited: ${generalForm.brand}` : "Select or Custom"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">+ Add Custom Brand</SelectItem>
                        {customBrands.length > 0 && customBrands.map((brand) => (
                          <SelectItem key={`custom-${brand}`} value={brand}>
                            {brand} ⭐
                          </SelectItem>
                        ))}
                        {POPULAR_BRANDS.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Category Section */}
                <div className="md:col-span-2">
                  <Label htmlFor="ebay-category" className="text-xs mb-1.5 block">Category <span className="text-red-500">*</span></Label>
                  <div className="space-y-2">
                    {/* Breadcrumb navigation */}
                    {selectedCategoryPath.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategoryPath([]);
                            handleMarketplaceChange("ebay", "categoryId", "");
                            handleMarketplaceChange("ebay", "categoryName", "");
                          }}
                          className="hover:text-foreground underline"
                        >
                          Home
                        </button>
                        {selectedCategoryPath.map((cat, index) => (
                          <React.Fragment key={cat.categoryId}>
                            <span>/</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newPath = selectedCategoryPath.slice(0, index + 1);
                                setSelectedCategoryPath(newPath);
                                const lastCat = newPath[newPath.length - 1];
                                const fullPath = newPath.map(c => c.categoryName).join(" > ");
                                handleMarketplaceChange("ebay", "categoryId", lastCat.categoryId);
                                handleMarketplaceChange("ebay", "categoryName", fullPath);
                              }}
                              className="hover:text-foreground underline"
                            >
                              {cat.categoryName}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                    
                    {isLoadingCategoryTree || isLoadingCategories ? (
                      <div className="flex items-center gap-2 p-3 border rounded-md">
                        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading categories...</span>
                      </div>
                    ) : categoriesError ? (
                      <div className="p-3 border rounded-md border-destructive/50 bg-destructive/10">
                        <p className="text-sm text-destructive">Error loading categories: {categoriesError.message}</p>
                        {categoriesError?.response?.details && (
                          <p className="text-xs text-destructive mt-2">
                            Details: {JSON.stringify(categoriesError.response.details)}
                          </p>
                        )}
                      </div>
                    ) : sortedCategories.length > 0 ? (
                      <Select
                        id="ebay-category"
                        name="ebay-category"
                        value={ebayForm.categoryId ? String(ebayForm.categoryId) : undefined}
                        onValueChange={(value) => {
                          const selectedCategory = sortedCategories.find(
                            cat => cat.category?.categoryId === value
                          );
                          
                          if (selectedCategory) {
                            const category = selectedCategory.category;
                            const newPath = [...selectedCategoryPath, {
                              categoryId: category.categoryId,
                              categoryName: category.categoryName,
                            }];
                            
                            // Check if this category has children
                            const hasChildren = selectedCategory.childCategoryTreeNodes && 
                              selectedCategory.childCategoryTreeNodes.length > 0 &&
                              !selectedCategory.leafCategoryTreeNode;
                            
                            if (hasChildren) {
                              // Navigate deeper into the tree
                              setSelectedCategoryPath(newPath);
                            } else {
                              // This is a leaf node - select it
                              const fullPath = newPath.map(c => c.categoryName).join(" > ");
                              handleMarketplaceChange("ebay", "categoryId", category.categoryId);
                              handleMarketplaceChange("ebay", "categoryName", fullPath);
                              setSelectedCategoryPath(newPath);
                            }
                          }
                        }}
                      >
                        <SelectTrigger id="ebay-category-trigger">
                          <SelectValue placeholder={selectedCategoryPath.length > 0 ? "Select subcategory" : "Select a category"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {sortedCategories.map((categoryNode) => {
                            const category = categoryNode.category;
                            if (!category || !category.categoryId) return null;
                            
                            const hasChildren = categoryNode.childCategoryTreeNodes && 
                              categoryNode.childCategoryTreeNodes.length > 0 &&
                              !categoryNode.leafCategoryTreeNode;
                            
                            return (
                              <SelectItem key={category.categoryId} value={category.categoryId}>
                                <div className="flex items-center gap-2">
                                  <span>{category.categoryName}</span>
                                  {hasChildren && (
                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-3 border rounded-md">
                        <p className="text-sm text-muted-foreground">No subcategories available.</p>
                      </div>
                    )}
                    
                    {ebayForm.categoryName && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          Selected: {ebayForm.categoryName}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            handleMarketplaceChange("ebay", "categoryId", "");
                            handleMarketplaceChange("ebay", "categoryName", "");
                            setSelectedCategoryPath([]);
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Category Specifics Section - Always show when category is selected */}
                {ebayForm.categoryId && (
                  <div className="md:col-span-2 space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Category Specifics</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Reload category aspects
                          queryClient.invalidateQueries(['ebayCategoryAspects', categoryTreeId, ebayForm.categoryId]);
                        }}
                        className="gap-2 h-7 text-xs"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {/* Loading state */}
                    {isLoadingEbayAspects && (
                      <div className="flex items-center gap-2 p-3 border rounded-md mb-4">
                        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading category specifics...</span>
                      </div>
                    )}

                    {/* Error state */}
                    {ebayAspectsError && !isLoadingEbayAspects && (
                      <div className="p-3 border rounded-md border-destructive/50 bg-destructive/10 mb-4">
                        <p className="text-sm text-destructive">Error loading category specifics: {ebayAspectsError.message}</p>
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer">Full error details</summary>
                          <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(ebayAspectsError, null, 2)}</pre>
                        </details>
                      </div>
                    )}

                    {/* Show raw API response in debug mode when no aspects found */}
                    {process.env.NODE_ENV === 'development' && !isLoadingEbayAspects && !ebayAspectsError && ebayCategoryAspects.length === 0 && ebayCategoryAspectsData && (
                      <div className="p-3 border rounded-md border-orange-500/50 bg-orange-500/10 mb-4">
                        <p className="text-sm text-orange-600">⚠️ API returned data but no aspects were found. Raw response:</p>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs">View raw API response</summary>
                          <pre className="mt-1 text-xs whitespace-pre-wrap break-all">{JSON.stringify(ebayCategoryAspectsData, null, 2)}</pre>
                        </details>
                      </div>
                    )}

                    {/* Debug info - collapsed by default, only in development */}
                    {process.env.NODE_ENV === 'development' && !isLoadingEbayAspects && ebayForm.categoryId && (
                      <details className="text-xs text-muted-foreground p-2 bg-muted rounded mb-2">
                        <summary className="cursor-pointer font-medium">
                          🔍 Debug: Category Aspects ({ebayCategoryAspects.length} found)
                        </summary>
                        <div className="space-y-1 mt-2">
                          <div>Category ID: {ebayForm.categoryId}</div>
                          <div>Category Name: {ebayForm.categoryName}</div>
                          {ebayAspectsError && (
                            <div className="text-red-600">Error: {ebayAspectsError.message}</div>
                          )}
                          {!ebayAspectsError && ebayCategoryAspects.length > 0 && (
                            <>
                              <div className="mt-2">Aspects:</div>
                              {ebayCategoryAspects.map((a, idx) => (
                                <div key={idx} className="ml-2 text-xs">
                                  - {a.localizedAspectName || a.aspectName || a.name || 'Unknown'} 
                                  ({a.aspectValues?.length || 0} values)
                                  <details className="ml-2">
                                    <summary className="cursor-pointer text-blue-600">View data</summary>
                                    <pre className="text-xs mt-1 whitespace-pre-wrap break-all">{JSON.stringify(a, null, 2)}</pre>
                                  </details>
                                </div>
                              ))}
                              {ebayTypeAspect ? (
                                <div className="text-green-600">
                                  ✓ Model/Type aspect found: {ebayTypeAspect.localizedAspectName || ebayTypeAspect.aspectName || ebayTypeAspect.name} ({ebayTypeValues.length} values)
                                </div>
                              ) : (
                                <div className="text-orange-600">
                                  ✗ No Model/Type aspect found. Check console for full aspect data.
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </details>
                    )}
                    
                    {/* Type and Condition side by side */}
                    {!isLoadingEbayAspects && !ebayAspectsError && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Type/Model Field - Show if ebayTypeAspect exists (even if no values yet, to show loading state) */}
                        {ebayTypeAspect ? (
                          <div>
                            <Label className="text-xs mb-1.5 block">
                              {ebayTypeAspect.localizedAspectName} <span className="text-red-500">*</span>
                            </Label>
                            {ebayTypeValues.length > 0 ? (
                              <Select
                                value={ebayForm.itemType ? String(ebayForm.itemType) : undefined}
                                onValueChange={(value) => handleMarketplaceChange("ebay", "itemType", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={`Select ${ebayTypeAspect.localizedAspectName.toLowerCase()}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {ebayTypeValues.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="text-xs text-muted-foreground p-2 border rounded">
                                Loading {ebayTypeAspect.localizedAspectName.toLowerCase()} options...
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground p-2 border rounded">
                            No Model/Type aspect available for this category.
                          </div>
                        )}

                        {/* Condition Dropdown */}
                        <div>
                          <Label className="text-xs mb-1.5 block">
                            Condition <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={ebayForm.condition ? String(ebayForm.condition) : undefined}
                            onValueChange={(value) => handleMarketplaceChange("ebay", "condition", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="New">New</SelectItem>
                              <SelectItem value="Open Box">Open Box</SelectItem>
                              <SelectItem value="Used">Used</SelectItem>
                              <SelectItem value="For parts or not working">For parts or not working</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Condition Dropdown - Show when no category selected */}
                {!ebayForm.categoryId && (
                  <div>
                    <Label className="text-xs mb-1.5 block">
                      Condition <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={ebayForm.condition ? String(ebayForm.condition) : undefined}
                      onValueChange={(value) => handleMarketplaceChange("ebay", "condition", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Open Box">Open Box</SelectItem>
                        <SelectItem value="Used">Used</SelectItem>
                        <SelectItem value="For parts or not working">For parts or not working</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* SKU Field */}
                <div>
                  <Label htmlFor="ebay-sku" className="text-xs mb-1.5 block">SKU</Label>
                  <Input
                    id="ebay-sku"
                    name="ebay-sku"
                    placeholder={generalForm.sku || "Enter SKU"}
                    value={ebayForm.sku || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "sku", e.target.value)}
                  />
                  {generalForm.sku && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.sku} from General form. You can edit this field.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Color <span className="text-red-500">*</span></Label>
                  <Button
                    type="button"
                    variant={ebayForm.color ? "default" : "outline"}
                    onClick={() => openColorPicker("ebay.color")}
                    className="w-full justify-start"
                  >
                    {ebayForm.color ? (
                      <>
                        <div
                          className="w-4 h-4 mr-2 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0"
                          style={{ backgroundColor: getColorHex(ebayForm.color) || "#808080" }}
                        />
                        <span className="flex-1 text-left">{getColorName(ebayForm.color)}</span>
                      </>
                    ) : (
                      <>
                        <Palette className="w-4 h-4 mr-2" />
                        <span>Select color</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-xs mb-1.5 block">Pricing Format <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.pricingFormat ? String(ebayForm.pricingFormat) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "pricingFormat", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Price</SelectItem>
                      <SelectItem value="auction">Auction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Duration <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.duration ? String(ebayForm.duration) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "duration", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good 'Til Canceled">Good 'Til Canceled</SelectItem>
                      <SelectItem value="30 Days">30 Days</SelectItem>
                      <SelectItem value="7 Days">7 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Buy It Now Price <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={generalForm.price || "0.00"}
                    value={ebayForm.buyItNowPrice || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "buyItNowPrice", e.target.value)}
                  />
                  {generalForm.price && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited ${generalForm.price} from General form. You can edit this price.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Allow Best Offer</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="ebay-best-offer"
                      checked={ebayForm.allowBestOffer}
                      onCheckedChange={(checked) => handleMarketplaceChange("ebay", "allowBestOffer", checked)}
                    />
                    <Label htmlFor="ebay-best-offer" className="text-sm">Allow buyers to submit offers</Label>
                  </div>
                </div>
              </div>

              {/* Save Default Button for Shipping Fields */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Shipping Settings</Label>
                </div>
                <div className="group relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveShippingDefaults}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                  <div className="absolute right-0 top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-50">
                    <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md shadow-lg border whitespace-nowrap">
                      Save Default
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Method <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.shippingMethod ? String(ebayForm.shippingMethod) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shippingMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard: Small to medium items">Standard: Small to medium items</SelectItem>
                      <SelectItem value="Local pickup only: Sell to buyer nears you">Local pickup only: Sell to buyer nears you</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Cost Type <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.shippingCostType ? String(ebayForm.shippingCostType) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shippingCostType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Calculated: Cost varies based on buyer location">Calculated: Cost varies based on buyer location</SelectItem>
                      <SelectItem value="Flat: Same cost regardless of buyer location">Flat: Same cost regardless of buyer location</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Cost <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={ebayForm.shippingCost || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "shippingCost", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Handling Time <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.handlingTime ? String(ebayForm.handlingTime) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "handlingTime", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1 business day">1 business day</SelectItem>
                      <SelectItem value="2 business days">2 business days</SelectItem>
                      <SelectItem value="3 business days">3 business days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Ship From Country</Label>
                  <Select
                    value={ebayForm.shipFromCountry ? String(ebayForm.shipFromCountry) : "United States"}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shipFromCountry", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Service <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.shippingService ? String(ebayForm.shippingService) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shippingService", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard Shipping (3 to 5 business days)">Standard Shipping (3 to 5 business days)</SelectItem>
                      <SelectItem value="Expedited Shipping (1 to 3 business days)">Expedited Shipping (1 to 3 business days)</SelectItem>
                      <SelectItem value="USPS Priority Mail">USPS Priority Mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Location Descriptions</Label>
                  <Input
                    placeholder="(e.g., 'Spain')"
                    value={ebayForm.locationDescriptions || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "locationDescriptions", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional descriptive text shown to buyers (e.g., "Spain")
                  </p>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Location</Label>
                  <Input
                    placeholder={generalForm.zip || "Zip or region"}
                    value={ebayForm.shippingLocation || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "shippingLocation", e.target.value)}
                  />
                  {generalForm.zip && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.zip} from General form. You can edit this field.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Accept Returns <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="ebay-accept-returns"
                      checked={ebayForm.acceptReturns}
                      onCheckedChange={(checked) => handleMarketplaceChange("ebay", "acceptReturns", checked)}
                    />
                    <Label htmlFor="ebay-accept-returns" className="text-sm">Accept returns</Label>
                  </div>
                </div>
                
                {/* Return fields - shown when Accept Returns is enabled */}
                {ebayForm.acceptReturns && (
                  <>
                    <div>
                      <Label className="text-xs mb-1.5 block">Return Within <span className="text-red-500">*</span></Label>
                      <Select
                        value={ebayForm.returnWithin ? String(ebayForm.returnWithin) : "30 days"}
                        onValueChange={(value) => handleMarketplaceChange("ebay", "returnWithin", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30 days">30 days</SelectItem>
                          <SelectItem value="60 days">60 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block">Return Shipping Payer <span className="text-red-500">*</span></Label>
                      <Select
                        value={ebayForm.returnShippingPayer ? String(ebayForm.returnShippingPayer) : "Buyer"}
                        onValueChange={(value) => handleMarketplaceChange("ebay", "returnShippingPayer", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Buyer">Buyer</SelectItem>
                          <SelectItem value="Free for buyer, you pay">Free for buyer, you pay</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block">Return Refund Method <span className="text-red-500">*</span></Label>
                      <Select
                        value={ebayForm.returnRefundMethod ? String(ebayForm.returnRefundMethod) : "Full Refund"}
                        onValueChange={(value) => handleMarketplaceChange("ebay", "returnRefundMethod", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full Refund">Full Refund</SelectItem>
                          <SelectItem value="Full Refund or Replacement">Full Refund or Replacement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              {/* Package Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Package Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Package Details <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant={generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight ? "default" : "outline"}
                    onClick={() => setPackageDetailsDialogOpen(true)}
                    className="w-full justify-start"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight
                      ? `${generalForm.packageWeight} lbs • ${generalForm.packageLength}" × ${generalForm.packageWidth}" × ${generalForm.packageHeight}"`
                      : "Enter weight & size"}
                  </Button>
                </div>
              </div>

              {/* eBay Listing Status - Show when item is listed */}
              {ebayListingId && (
                <div className="mt-6 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-green-600" />
                      <Label className="text-sm font-semibold">Listing Active</Label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">eBay Listing ID</Label>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-background px-2 py-1 rounded border">{ebayListingId}</code>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          const url = getEbayItemUrl(ebayListingId);
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Listing
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        onClick={async () => {
                          if (!confirm('Are you sure you want to end this eBay listing? This action cannot be undone.')) {
                            return;
                          }
                          
                          try {
                            setIsSaving(true);
                            const response = await fetch('/api/ebay/listing', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                operation: 'EndItem',
                                itemId: ebayListingId,
                                userToken: ebayToken?.access_token,
                              }),
                            });

                            if (!response.ok) {
                              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                              throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
                            }

                            const result = await response.json();
                            
                            if (result.Ack === 'Success' || result.Ack === 'Warning') {
                              // Clear listing ID
                              setEbayListingId(null);
                              if (currentEditingItemId) {
                                localStorage.removeItem(`ebay_listing_${currentEditingItemId}`);
                              }
                              
                              // Update inventory item status
                              if (currentEditingItemId) {
                                try {
                                  await base44.entities.InventoryItem.update(currentEditingItemId, {
                                    status: 'available',
                                    ebay_listing_id: '',
                                  });
                                  queryClient.invalidateQueries(['inventoryItems']);
                                } catch (updateError) {
                                  console.error('Error updating inventory item:', updateError);
                                }
                              }

                              toast({
                                title: "Listing ended",
                                description: "Your eBay listing has been ended successfully.",
                              });
                            } else {
                              throw new Error(result.Errors?.join(', ') || 'Failed to end listing');
                            }
                          } catch (error) {
                            console.error('Error ending eBay listing:', error);
                            toast({
                              title: "Failed to end listing",
                              description: error.message || "An error occurred while ending the listing. Please try again.",
                              variant: "destructive",
                            });
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                      >
                        <Unlock className="h-4 w-4" />
                        Delist
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!ebayListingId && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("ebay")}>
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                  <Button className="gap-2" onClick={() => handleListOnMarketplace("ebay")}>
                    List on eBay
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Etsy Form */}
          {activeForm === "etsy" && (
            <div className="space-y-6">
              {currentEditingItemId && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Item ID:</span>
                  <span className="text-sm text-muted-foreground font-mono">{currentEditingItemId}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Etsy listing profile</h3>
                  <p className="text-sm text-muted-foreground">
                    Etsy loves rich listings—processing time and "who made it" details are required.
                  </p>
                </div>
              </div>

              {/* Photos and Title Section */}
              <div className="space-y-6">
                {/* Photos Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                    {(etsyForm.photos?.length > 0) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAllPhotos('etsy')}
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Delete All
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {/* Main Photo - spans 2 columns and 2 rows */}
                    {etsyForm.photos?.length > 0 && (
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", "0");
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = 0;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'etsy');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                      >
                        <img src={etsyForm.photos[0].preview || etsyForm.photos[0].imageUrl} alt={etsyForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                          Main
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(etsyForm.photos[0].id, 'etsy');
                          }}
                          className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Other Photos */}
                    {etsyForm.photos?.slice(1).map((photo, index) => (
                      <div
                        key={photo.id || index + 1}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(index + 1));
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = index + 1;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'etsy');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                          <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id, 'etsy');
                          }}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    
                    {/* Add Photo Button - same size as photo tiles */}
                    {(etsyForm.photos?.length || 0) < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => etsyPhotoInputRef.current?.click()}
                        disabled={isUploadingPhotos}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                      >
                        <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                        <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                      </button>
                    )}
                    <input
                      ref={etsyPhotoInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'etsy')}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {etsyForm.photos?.length || 0}/{MAX_PHOTOS} used.
                    {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                  </p>
                </div>
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Title Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Title</Label>
                  <Input
                    placeholder="Enter listing title"
                    value={etsyForm.title || ""}
                    onChange={(e) => handleMarketplaceChange("etsy", "title", e.target.value)}
                  />
                </div>

                {/* Description Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <RichTextarea
                    placeholder={generalForm.description ? `Inherited from General` : "Enter Etsy-specific description..."}
                    value={etsyForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("etsy", "description", e.target.value)}
                    className="min-h-[120px]"
                  />
                  {generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* Brand Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Brand</Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter brand name and press Enter to save"
                        value={etsyForm.brand || ""}
                        onChange={(e) => handleMarketplaceChange("etsy", "brand", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && etsyForm.brand?.trim()) {
                            e.preventDefault();
                            const savedBrand = addCustomBrand(etsyForm.brand);
                            if (savedBrand) {
                              setBrandIsCustom(false);
                            }
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => {
                          if (etsyForm.brand?.trim()) {
                            const savedBrand = addCustomBrand(etsyForm.brand);
                            if (savedBrand) {
                              setBrandIsCustom(false);
                            }
                          }
                        }}
                        disabled={!etsyForm.brand?.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrandIsCustom(false);
                          handleMarketplaceChange("etsy", "brand", "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={etsyForm.brand || generalForm.brand || undefined}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          setBrandIsCustom(true);
                          handleMarketplaceChange("etsy", "brand", "");
                        } else {
                          handleMarketplaceChange("etsy", "brand", value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalForm.brand ? `Inherited: ${generalForm.brand}` : "Select or Custom"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">+ Add Custom Brand</SelectItem>
                        {customBrands.length > 0 && customBrands.map((brand) => (
                          <SelectItem key={`custom-${brand}`} value={brand}>
                            {brand} ⭐
                          </SelectItem>
                        ))}
                        {POPULAR_BRANDS.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* SKU Field */}
                <div>
                  <Label className="text-xs mb-1.5 block">SKU</Label>
                  <Input
                    placeholder={generalForm.sku || "Enter SKU"}
                    value={etsyForm.sku || ""}
                    onChange={(e) => handleMarketplaceChange("etsy", "sku", e.target.value)}
                  />
                  {generalForm.sku && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.sku} from General form. You can edit this field.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Processing Time</Label>
                  <Select
                    value={etsyForm.processingTime}
                    onValueChange={(value) => handleMarketplaceChange("etsy", "processingTime", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-2 business days">1-2 business days</SelectItem>
                      <SelectItem value="1-3 business days">1-3 business days</SelectItem>
                      <SelectItem value="3-5 business days">3-5 business days</SelectItem>
                      <SelectItem value="1-2 weeks">1-2 weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Renewal Option</Label>
                  <Select
                    value={etsyForm.renewalOption}
                    onValueChange={(value) => handleMarketplaceChange("etsy", "renewalOption", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="automatic">Automatic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Who made it?</Label>
                  <Select
                    value={etsyForm.whoMade}
                    onValueChange={(value) => handleMarketplaceChange("etsy", "whoMade", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="i_did">I did</SelectItem>
                      <SelectItem value="collective">A member of my shop</SelectItem>
                      <SelectItem value="someone_else">Another company or person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">When was it made?</Label>
                  <Select
                    value={etsyForm.whenMade}
                    onValueChange={(value) => handleMarketplaceChange("etsy", "whenMade", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2020s">2020s</SelectItem>
                      <SelectItem value="2010s">2010s</SelectItem>
                      <SelectItem value="2000s">2000s</SelectItem>
                      <SelectItem value="before_2000">Before 2000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Shipping Profile</Label>
                  <Input
                    placeholder="Link your saved Etsy shipping profile"
                    value={etsyForm.shippingProfile}
                    onChange={(e) => handleMarketplaceChange("etsy", "shippingProfile", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Tags</Label>
                  <TagInput
                    placeholder={etsyForm.inheritGeneral ? "Inherits general tags" : "Type keywords and press space or comma to add tags"}
                    value={etsyForm.tags}
                    onChange={(value) => handleMarketplaceChange("etsy", "tags", value)}
                    disabled={false}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Digital Download</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="etsy-digital"
                      checked={etsyForm.isDigital}
                      onCheckedChange={(checked) => handleMarketplaceChange("etsy", "isDigital", checked)}
                    />
                    <Label htmlFor="etsy-digital" className="text-sm">This is a digital product</Label>
                  </div>
                </div>
              </div>

              {/* Package Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Package Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Package Details <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant={generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight ? "default" : "outline"}
                    onClick={() => setPackageDetailsDialogOpen(true)}
                    className="w-full justify-start"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight
                      ? `${generalForm.packageWeight} lbs • ${generalForm.packageLength}" × ${generalForm.packageWidth}" × ${generalForm.packageHeight}"`
                      : "Enter weight & size"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-muted-foreground/30 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Etsy to refresh shipping profiles & shop policies.
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("etsy")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Etsy
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("etsy")}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button className="gap-2" onClick={() => handleListOnMarketplace("etsy")}>
                  List on Etsy
                </Button>
              </div>
            </div>
          )}

          {/* Mercari Form */}
          {activeForm === "mercari" && (
            <div className="space-y-6">
              {currentEditingItemId && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Item ID:</span>
                  <span className="text-sm text-muted-foreground font-mono">{currentEditingItemId}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Mercari smart pricing</h3>
                  <p className="text-sm text-muted-foreground">
                    Control smart pricing and shipping preferences for Mercari listings.
                  </p>
                </div>
              </div>

              {/* Photos and Title Section */}
              <div className="space-y-6">
                {/* Photos Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                    {(mercariForm.photos?.length > 0) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAllPhotos('mercari')}
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Delete All
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {/* Main Photo - spans 2 columns and 2 rows */}
                    {mercariForm.photos?.length > 0 && (
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", "0");
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = 0;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'mercari');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                      >
                        <img src={mercariForm.photos[0].preview || mercariForm.photos[0].imageUrl} alt={mercariForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                          Main
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(mercariForm.photos[0].id, 'mercari');
                          }}
                          className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Other Photos */}
                    {mercariForm.photos?.slice(1).map((photo, index) => (
                      <div
                        key={photo.id || index + 1}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(index + 1));
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = index + 1;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'mercari');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                          <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id, 'mercari');
                          }}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    
                    {/* Add Photo Button - same size as photo tiles */}
                    {(mercariForm.photos?.length || 0) < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => mercariPhotoInputRef.current?.click()}
                        disabled={isUploadingPhotos}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                      >
                        <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                        <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                      </button>
                    )}
                    <input
                      ref={mercariPhotoInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'mercari')}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {mercariForm.photos?.length || 0}/{MAX_PHOTOS} used.
                    {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                  </p>
                </div>
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Title Section */}
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Title <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder={generalForm.title ? `Inherited: ${generalForm.title}` : "What are you selling?"}
                    value={mercariForm.title || ""}
                    onChange={(e) => handleMarketplaceChange("mercari", "title", e.target.value)}
                  />
                  {generalForm.title && !mercariForm.title && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* Description Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">Description <span className="text-red-500">*</span></Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <RichTextarea
                    placeholder={generalForm.description ? `Inherited from General` : "Describe your item (5+ words)"}
                    value={mercariForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("mercari", "description", e.target.value)}
                    className="min-h-[120px]"
                  />
                  {generalForm.description && !mercariForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>
              </div>

              {/* Category Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Category</Label>
                </div>
              </div>

              <div className="mb-6">
                <Label className="text-xs mb-1.5 block">Category <span className="text-red-500">*</span></Label>
                
                {/* Category breadcrumb */}
                {mercariCategoryPath.length > 0 && (
                  <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setMercariCategoryPath([]);
                        handleMarketplaceChange("mercari", "mercariCategory", "");
                        handleMarketplaceChange("mercari", "mercariCategoryId", "");
                      }}
                      className="hover:text-foreground underline"
                    >
                      Home
                    </button>
                    {mercariCategoryPath.map((cat, index) => (
                      <React.Fragment key={cat.id}>
                        <span>/</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newPath = mercariCategoryPath.slice(0, index + 1);
                            setMercariCategoryPath(newPath);
                            const fullPath = newPath.map(c => c.name).join(" > ");
                            handleMarketplaceChange("mercari", "mercariCategory", fullPath);
                            handleMarketplaceChange("mercari", "mercariCategoryId", newPath[newPath.length - 1].id);
                          }}
                          className="hover:text-foreground underline"
                        >
                          {cat.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                )}
                
                {/* Show selected category badge */}
                {mercariForm.mercariCategory && (
                  <div className="mb-2">
                    <Badge variant="secondary" className="text-xs">
                      Selected: {mercariForm.mercariCategory}
                    </Badge>
                  </div>
                )}
                
                {/* Mercari Category Dropdown - Multi-level */}
                <Select
                  value=""
                  onValueChange={(value) => {
                    // Get current level categories
                    let currentLevel = MERCARI_CATEGORIES;
                    
                    // Navigate to current path's subcategories
                    for (const pathItem of mercariCategoryPath) {
                      currentLevel = currentLevel[pathItem.id]?.subcategories || {};
                    }
                    
                    // Find selected category
                    const selected = currentLevel[value];
                    if (selected) {
                      const newPath = [...mercariCategoryPath, { id: selected.id, name: selected.name }];
                      
                      // Check if has subcategories
                      if (selected.subcategories && Object.keys(selected.subcategories).length > 0) {
                        // Has subcategories - navigate deeper
                        setMercariCategoryPath(newPath);
                      } else {
                        // Leaf node - select it
                        const fullPath = newPath.map(c => c.name).join(" > ");
                        handleMarketplaceChange("mercari", "mercariCategory", fullPath);
                        handleMarketplaceChange("mercari", "mercariCategoryId", selected.id);
                        setMercariCategoryPath(newPath);
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      mercariCategoryPath.length > 0 
                        ? `Select ${mercariCategoryPath[mercariCategoryPath.length - 1].name} subcategory...`
                        : "Select category"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      // Get categories for current level
                      let currentLevel = MERCARI_CATEGORIES;
                      
                      // Navigate to current path
                      for (const pathItem of mercariCategoryPath) {
                        currentLevel = currentLevel[pathItem.id]?.subcategories || {};
                      }
                      
                      // Render options
                      return Object.values(currentLevel).map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                          {cat.subcategories && Object.keys(cat.subcategories).length > 0 ? ' →' : ''}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
                
                {/* Auto-suggest based on General form category */}
                {generalForm.category && !mercariForm.mercariCategory && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    💡 Suggested: 
                    {generalForm.category.toLowerCase().includes('women') || (generalForm.category.toLowerCase().includes('clothing') && !generalForm.category.toLowerCase().includes('men')) ? ' Women' : ''}
                    {generalForm.category.toLowerCase().includes('men') && !generalForm.category.toLowerCase().includes('women') ? ' Men' : ''}
                    {generalForm.category.toLowerCase().includes('electronic') ? ' Electronics' : ''}
                    {generalForm.category.toLowerCase().includes('toy') ? ' Toys & Collectibles' : ''}
                    {generalForm.category.toLowerCase().includes('home') || generalForm.category.toLowerCase().includes('furniture') ? ' Home' : ''}
                    {generalForm.category.toLowerCase().includes('beauty') ? ' Beauty' : ''}
                    {generalForm.category.toLowerCase().includes('kid') || generalForm.category.toLowerCase().includes('baby') ? ' Kids' : ''}
                    {generalForm.category.toLowerCase().includes('vintage') || generalForm.category.toLowerCase().includes('collectible') ? ' Vintage & collectibles' : ''}
                    {generalForm.category.toLowerCase().includes('sport') || generalForm.category.toLowerCase().includes('outdoor') || generalForm.category.toLowerCase().includes('grill') || generalForm.category.toLowerCase().includes('cooking') ? ' Sports & outdoors or Garden & Outdoor' : ''}
                    {generalForm.category.toLowerCase().includes('handmade') ? ' Handmade' : ''}
                    {generalForm.category.toLowerCase().includes('art') || generalForm.category.toLowerCase().includes('craft') ? ' Arts & Crafts' : ''}
                    {generalForm.category.toLowerCase().includes('pet') ? ' Pet Supplies' : ''}
                    {generalForm.category.toLowerCase().includes('garden') || generalForm.category.toLowerCase().includes('yard') ? ' Garden & Outdoor' : ''}
                    {generalForm.category.toLowerCase().includes('office') ? ' Office' : ''}
                    {generalForm.category.toLowerCase().includes('tool') ? ' Tools' : ''}
                    {generalForm.category.toLowerCase().includes('book') ? ' Books' : ''}
                  </p>
                )}

                {/* Size Field - Only shows for clothing/shoes/apparel categories */}
                {((mercariForm.category !== undefined ? mercariForm.category : generalForm.category)?.toLowerCase().includes('clothing') ||
                  (mercariForm.category !== undefined ? mercariForm.category : generalForm.category)?.toLowerCase().includes('shoes') ||
                  (mercariForm.category !== undefined ? mercariForm.category : generalForm.category)?.toLowerCase().includes('apparel') ||
                  (mercariForm.category !== undefined ? mercariForm.category : generalForm.category)?.toLowerCase().includes('men') ||
                  (mercariForm.category !== undefined ? mercariForm.category : generalForm.category)?.toLowerCase().includes('women') ||
                  (mercariForm.category !== undefined ? mercariForm.category : generalForm.category)?.toLowerCase().includes('kids')) && (
                  <div className="mt-4">
                    <Label className="text-xs mb-1.5 block">
                      Size <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder={generalForm.size ? `Inherited: ${generalForm.size}` : "e.g., M, L, XL, 32, 10"}
                      value={mercariForm.size || ""}
                      onChange={(e) => handleMarketplaceChange("mercari", "size", e.target.value)}
                      required
                    />
                    {generalForm.size && !mercariForm.size && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Inherited from General form. You can edit this field.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Brand Section - No custom brand for Mercari */}
                <div>
                  <Label className="text-xs mb-1.5 block">Brand</Label>
                  <Select
                    value={mercariForm.brand || generalForm.brand || ""}
                    onValueChange={(value) => handleMarketplaceChange("mercari", "brand", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={generalForm.brand ? `Inherited: ${generalForm.brand}` : "Select brand"} />
                    </SelectTrigger>
                    <SelectContent>
                      {customBrands.length > 0 && customBrands.map((brand) => (
                        <SelectItem key={`custom-${brand}`} value={brand}>
                          {brand} ⭐
                        </SelectItem>
                      ))}
                      {POPULAR_BRANDS.map((brand) => (
                        <SelectItem key={brand} value={brand}>
                          {brand}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {generalForm.brand && !mercariForm.brand && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.brand} from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* Condition Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Condition <span className="text-red-500">*</span></Label>
                  <Select
                    value={mercariForm.condition || generalForm.condition || ""}
                    onValueChange={(value) => handleMarketplaceChange("mercari", "condition", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={generalForm.condition ? `Inherited: ${generalForm.condition}` : "Select condition"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Like New">Like New</SelectItem>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Fair">Fair</SelectItem>
                      <SelectItem value="Poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                  {generalForm.condition && !mercariForm.condition && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* Color Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Color</Label>
                  <Select
                    value={mercariForm.color || generalForm.color || ""}
                    onValueChange={(value) => handleMarketplaceChange("mercari", "color", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={generalForm.color ? `Inherited: ${generalForm.color}` : "Select color (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Black">Black</SelectItem>
                      <SelectItem value="White">White</SelectItem>
                      <SelectItem value="Gray">Gray</SelectItem>
                      <SelectItem value="Brown">Brown</SelectItem>
                      <SelectItem value="Beige">Beige</SelectItem>
                      <SelectItem value="Red">Red</SelectItem>
                      <SelectItem value="Pink">Pink</SelectItem>
                      <SelectItem value="Orange">Orange</SelectItem>
                      <SelectItem value="Yellow">Yellow</SelectItem>
                      <SelectItem value="Green">Green</SelectItem>
                      <SelectItem value="Blue">Blue</SelectItem>
                      <SelectItem value="Purple">Purple</SelectItem>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                      <SelectItem value="Multi-Color">Multi-Color</SelectItem>
                    </SelectContent>
                  </Select>
                  {generalForm.color && !mercariForm.color && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

              </div>

              {/* Pricing & Inventory Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Pricing & Inventory</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Listing Price */}
                <div>
                  <Label className="text-xs mb-1.5 block">Listing Price <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    placeholder={generalForm.price ? `Inherited: $${generalForm.price}` : "(min $1/max $2000)"}
                    value={mercariForm.price || ""}
                    onChange={(e) => handleMarketplaceChange("mercari", "price", e.target.value)}
                    className="text-right"
                  />
                  {generalForm.price && !mercariForm.price && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <Label className="text-xs mb-1.5 block">Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder={generalForm.quantity ? `Inherited: ${generalForm.quantity}` : "1"}
                    value={mercariForm.quantity || ""}
                    onChange={(e) => handleMarketplaceChange("mercari", "quantity", e.target.value)}
                  />
                  {generalForm.quantity && !mercariForm.quantity && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>
              </div>

              {/* Shipping Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Shipping</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Ships From (Zip Code) */}
                <div>
                  <Label className="text-xs mb-1.5 block">Ships From (Zip Code) <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Enter your zip code"
                    value={mercariForm.shipsFrom || ""}
                    onChange={(e) => handleMarketplaceChange("mercari", "shipsFrom", e.target.value)}
                    maxLength={5}
                  />
                </div>

                {/* Delivery Method */}
                <div>
                  <Label className="text-xs mb-1.5 block">Delivery Method <span className="text-red-500">*</span></Label>
                  <Select
                    value={mercariForm.deliveryMethod || "prepaid"}
                    onValueChange={(value) => handleMarketplaceChange("mercari", "deliveryMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prepaid">Mercari Prepaid Label</SelectItem>
                      <SelectItem value="ship_on_own">Ship on Your Own</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>


              <div className="flex flex-col gap-3 rounded-lg border border-muted-foreground/30 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  Update Mercari connection to sync latest shipping labels & rates.
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("mercari")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Mercari
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("mercari")}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button className="gap-2" onClick={() => handleListOnMarketplace("mercari")}>
                  List on Mercari
                </Button>
              </div>
            </div>
          )}

          {/* Facebook Form */}
          {activeForm === "facebook" && (
            <div className="space-y-6">
              {currentEditingItemId && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Item ID:</span>
                  <span className="text-sm text-muted-foreground font-mono">{currentEditingItemId}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Facebook Marketplace</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure shipping vs pickup defaults and whether offers are allowed.
                  </p>
                </div>
              </div>

              {/* Photos and Title Section */}
              <div className="space-y-6">
                {/* Photos Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                    {(facebookForm.photos?.length > 0) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAllPhotos('facebook')}
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Delete All
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {/* Main Photo - spans 2 columns and 2 rows */}
                    {facebookForm.photos?.length > 0 && (
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", "0");
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = 0;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'facebook');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                      >
                        <img src={facebookForm.photos[0].preview || facebookForm.photos[0].imageUrl} alt={facebookForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                          Main
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(facebookForm.photos[0].id, 'facebook');
                          }}
                          className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Other Photos */}
                    {facebookForm.photos?.slice(1).map((photo, index) => (
                      <div
                        key={photo.id || index + 1}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(index + 1));
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = index + 1;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'facebook');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                          <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id, 'facebook');
                          }}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    
                    {/* Add Photo Button - same size as photo tiles */}
                    {(facebookForm.photos?.length || 0) < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => facebookPhotoInputRef.current?.click()}
                        disabled={isUploadingPhotos}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                      >
                        <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                        <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                      </button>
                    )}
                    <input
                      ref={facebookPhotoInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'facebook')}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {facebookForm.photos?.length || 0}/{MAX_PHOTOS} used.
                    {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                  </p>
                </div>
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Title Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Title</Label>
                  <Input
                    placeholder="Enter listing title"
                    value={facebookForm.title || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "title", e.target.value)}
                  />
                </div>

                {/* Description Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <RichTextarea
                    placeholder={generalForm.description ? `Inherited from General` : "Enter Facebook-specific description..."}
                    value={facebookForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "description", e.target.value)}
                    className="min-h-[120px]"
                  />
                  {generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>
              </div>

              {/* Category Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Category</Label>
                </div>
              </div>

              <div className="mb-6">
                <Label className="text-xs mb-1.5 block">
                  Category <span className="text-red-500">*</span>
                </Label>
                
                {/* Breadcrumb navigation for category path */}
                {generalCategoryPath.length > 0 && (
                  <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setGeneralCategoryPath([]);
                        handleMarketplaceChange("facebook", "category", "");
                        handleMarketplaceChange("facebook", "categoryId", "");
                      }}
                      className="hover:text-foreground underline"
                    >
                      Home
                    </button>
                    {generalCategoryPath.map((cat, index) => (
                      <React.Fragment key={cat.categoryId}>
                        <span>/</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newPath = generalCategoryPath.slice(0, index + 1);
                            setGeneralCategoryPath(newPath);
                            const lastCat = newPath[newPath.length - 1];
                            const fullPath = newPath.map(c => c.categoryName).join(" > ");
                            handleMarketplaceChange("facebook", "category", fullPath);
                            if (lastCat?.categoryId) {
                              handleMarketplaceChange("facebook", "categoryId", lastCat.categoryId);
                            }
                          }}
                          className="hover:text-foreground underline"
                        >
                          {cat.categoryName}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                )}
                
                {/* Show selected category badge */}
                {((facebookForm.category !== undefined ? facebookForm.category : generalForm.category) || generalCategoryPath.length > 0) && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Selected: {facebookForm.category !== undefined ? facebookForm.category : generalForm.category}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleMarketplaceChange("facebook", "category", "");
                          handleMarketplaceChange("facebook", "categoryId", "");
                          setGeneralCategoryPath([]);
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Category Dropdown - Inherits from General or allows selection */}
                {!isLoadingCategoryTree && categoryTreeId ? (
                  generalCategoryPath.length > 0 && sortedCategories.length === 0 ? (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-md">
                      <p className="text-sm text-green-700 dark:text-green-400">
                        ✓ Category selected: {facebookForm.category || generalForm.category}
                      </p>
                    </div>
                  ) : sortedCategories.length > 0 ? (
                    <Select
                      value={undefined}
                      onValueChange={(value) => {
                        const selectedCategory = sortedCategories.find(
                          cat => cat.category?.categoryId === value
                        );
                        
                        if (selectedCategory) {
                          const category = selectedCategory.category;
                          const newPath = [...generalCategoryPath, {
                            categoryId: category.categoryId,
                            categoryName: category.categoryName,
                          }];
                          
                          // Check if this category has children
                          const hasChildren = selectedCategory.childCategoryTreeNodes && 
                            selectedCategory.childCategoryTreeNodes.length > 0 &&
                            !selectedCategory.leafCategoryTreeNode;
                          
                          if (hasChildren) {
                            // Navigate deeper into the tree
                            setGeneralCategoryPath(newPath);
                          } else {
                            // This is a leaf node - select it
                            const fullPath = newPath.map(c => c.categoryName).join(" > ");
                            const categoryId = category.categoryId;
                            handleMarketplaceChange("facebook", "category", fullPath);
                            handleMarketplaceChange("facebook", "categoryId", categoryId);
                            setGeneralCategoryPath(newPath);
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalCategoryPath.length > 0 ? "Select subcategory" : "Select a category"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {sortedCategories.map((categoryNode) => {
                          const category = categoryNode.category;
                          if (!category || !category.categoryId) return null;
                          
                          const hasChildren = categoryNode.childCategoryTreeNodes && 
                            categoryNode.childCategoryTreeNodes.length > 0 &&
                            !categoryNode.leafCategoryTreeNode;
                          
                          return (
                            <SelectItem key={category.categoryId} value={category.categoryId}>
                              {category.categoryName} {hasChildren && '›'}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 bg-muted/50 border rounded-md text-sm text-muted-foreground">
                      {generalForm.category 
                        ? `Using category from General: ${generalForm.category}`
                        : 'Loading categories...'}
                    </div>
                  )
                ) : (
                  <div className="p-3 bg-muted/50 border rounded-md text-sm text-muted-foreground">
                    {generalForm.category 
                      ? `Inherited from General: ${generalForm.category}`
                      : 'Category tree loading...'}
                  </div>
                )}
              </div>

              {/* Category Specifics - Show when category is selected */}
              {(facebookForm.category || generalForm.category || facebookForm.categoryId || generalForm.categoryId) && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium">Category Specifics</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Refresh category specifics
                        toast({
                          title: "Refreshed",
                          description: "Category specifics updated",
                        });
                      }}
                      className="h-6 px-2"
                      title="Refresh category specifics"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Condition - Always show */}
                    <div>
                      <Label className="text-xs mb-1.5 block">
                        Condition <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={facebookForm.condition || generalForm.condition || undefined}
                        onValueChange={(value) => handleMarketplaceChange("facebook", "condition", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={generalForm.condition ? `Inherited: ${generalForm.condition}` : "Select condition"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="used_like_new">Used - Like New</SelectItem>
                          <SelectItem value="used_good">Used - Good</SelectItem>
                          <SelectItem value="used_fair">Used - Fair</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Size - Show for clothing/shoes categories */}
                    {(facebookForm.category?.toLowerCase().includes('clothing') || 
                      facebookForm.category?.toLowerCase().includes('shoes') ||
                      facebookForm.category?.toLowerCase().includes('apparel') ||
                      generalForm.category?.toLowerCase().includes('clothing') ||
                      generalForm.category?.toLowerCase().includes('shoes') ||
                      generalForm.category?.toLowerCase().includes('apparel')) && (
                      <div>
                        <Label className="text-xs mb-1.5 block">
                          Size <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          placeholder={generalForm.size ? `Inherited: ${generalForm.size}` : "Enter size (e.g., M, L, XL, 10, 42)"}
                          value={facebookForm.size || ""}
                          onChange={(e) => handleMarketplaceChange("facebook", "size", e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Show More Details Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFacebookMoreDetails(!showFacebookMoreDetails)}
                    className="mt-4 mb-4"
                  >
                    {showFacebookMoreDetails ? 'Hide Optional Details' : 'Show More Details'}
                  </Button>

                  {/* Optional Details - Show when toggled */}
                  {showFacebookMoreDetails && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-md border">
                      {/* Brand */}
                      <div>
                        <Label className="text-xs mb-1.5 block">Brand</Label>
                        {brandIsCustom ? (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter brand and press Enter"
                              value={facebookForm.brand || ""}
                              onChange={(e) => handleMarketplaceChange("facebook", "brand", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && facebookForm.brand?.trim()) {
                                  e.preventDefault();
                                  addCustomBrand(facebookForm.brand);
                                  setBrandIsCustom(false);
                                }
                              }}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setBrandIsCustom(false);
                                handleMarketplaceChange("facebook", "brand", "");
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Select
                            value={facebookForm.brand || generalForm.brand || undefined}
                            onValueChange={(value) => {
                              if (value === "custom") {
                                setBrandIsCustom(true);
                                handleMarketplaceChange("facebook", "brand", "");
                              } else {
                                handleMarketplaceChange("facebook", "brand", value);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select brand" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="custom">+ Add Custom Brand</SelectItem>
                              {customBrands.map((brand) => (
                                <SelectItem key={`custom-${brand}`} value={brand}>
                                  {brand} ⭐
                                </SelectItem>
                              ))}
                              {POPULAR_BRANDS.map((brand) => (
                                <SelectItem key={brand} value={brand}>
                                  {brand}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Type */}
                      <div>
                        <Label className="text-xs mb-1.5 block">Type</Label>
                        <Input
                          placeholder="e.g., DSLR, Point & Shoot, Mirrorless"
                          value={facebookForm.itemType || ""}
                          onChange={(e) => handleMarketplaceChange("facebook", "itemType", e.target.value)}
                        />
                      </div>

                      {/* Color */}
                      <div>
                        <Label className="text-xs mb-1.5 block">Color</Label>
                        <Input
                          placeholder={generalForm.color1 ? `Inherited: ${generalForm.color1}` : "Primary color"}
                          value={facebookForm.color || ""}
                          onChange={(e) => handleMarketplaceChange("facebook", "color", e.target.value)}
                        />
                      </div>

                      {/* Additional category-specific field examples */}
                      {facebookForm.category?.toLowerCase().includes('camera') && (
                        <div>
                          <Label className="text-xs mb-1.5 block">Camera Megapixels</Label>
                          <Input
                            placeholder="e.g., 24 MP"
                            value={facebookForm.megapixels || ""}
                            onChange={(e) => handleMarketplaceChange("facebook", "megapixels", e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Pricing and Quantity Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Pricing & Inventory</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Listing Price */}
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Listing Price <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder={generalForm.price ? `Inherited: $${generalForm.price}` : "Enter price"}
                    value={facebookForm.price || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "price", e.target.value)}
                  />
                  {generalForm.price && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited ${generalForm.price} from General form
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Quantity <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder={generalForm.quantity ? `Inherited: ${generalForm.quantity}` : "1"}
                    value={facebookForm.quantity || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "quantity", e.target.value)}
                  />
                  {generalForm.quantity && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form
                    </p>
                  )}
                </div>
              </div>

              {/* Shipping Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Shipping & Pickup</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Delivery Method</Label>
                  <Select
                    value={facebookForm.deliveryMethod}
                    onValueChange={(value) => handleMarketplaceChange("facebook", "deliveryMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shipping_and_pickup">Shipping & Local Pickup</SelectItem>
                      <SelectItem value="shipping_only">Shipping Only</SelectItem>
                      <SelectItem value="pickup_only">Pickup Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Flat Shipping Price</Label>
                  <Input
                    placeholder="Optional override"
                    value={facebookForm.shippingPrice}
                    onChange={(e) => handleMarketplaceChange("facebook", "shippingPrice", e.target.value)}
                    disabled={false}
                  />
                  {facebookForm.inheritGeneral && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Uses General pricing when sync is enabled.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Meetup Location</Label>
                  <Input
                    placeholder={generalForm.zip ? `Inherited from General: ${generalForm.zip}` : "Preferred meetup details"}
                    value={facebookForm.meetUpLocation}
                    onChange={(e) => handleMarketplaceChange("facebook", "meetUpLocation", e.target.value)}
                  />
                  {generalForm.zip && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.zip} from General form. You can edit this field.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Allow Offers</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="facebook-allow-offers"
                      checked={facebookForm.allowOffers}
                      onCheckedChange={(checked) => handleMarketplaceChange("facebook", "allowOffers", checked)}
                    />
                    <Label htmlFor="facebook-allow-offers" className="text-sm">Allow Messenger offers</Label>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Local Pickup</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="facebook-local-pickup"
                      checked={facebookForm.localPickup}
                      onCheckedChange={(checked) => handleMarketplaceChange("facebook", "localPickup", checked)}
                    />
                    <Label htmlFor="facebook-local-pickup" className="text-sm">Offer local pickup</Label>
                  </div>
                </div>
              </div>

              {/* Additional Options Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Additional Options</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Tags */}
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Tags</Label>
                  <Input
                    placeholder={generalForm.tags ? `Inherited: ${generalForm.tags}` : "Comma-separated tags (e.g., vintage, luxury, gift)"}
                    value={facebookForm.tags || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "tags", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use up to 20 tags someone might search for
                  </p>
                </div>

                {/* SKU */}
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">SKU</Label>
                  <Input
                    placeholder={generalForm.sku ? `Inherited: ${generalForm.sku}` : "Internal SKU (optional)"}
                    value={facebookForm.sku || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "sku", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Only visible to you
                  </p>
                </div>
              </div>

              {/* Privacy Settings Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Privacy Settings</Label>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-3">
                  <Switch
                    id="facebook-hide-from-friends"
                    checked={facebookForm.hideFromFriends}
                    onCheckedChange={(checked) => handleMarketplaceChange("facebook", "hideFromFriends", checked)}
                  />
                  <div>
                    <Label htmlFor="facebook-hide-from-friends" className="text-sm cursor-pointer">Hide from friends</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This listing will be hidden from your Facebook friends but visible to other people on Facebook
                    </p>
                  </div>
                </div>
              </div>

              {/* Package Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Package Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Package Details <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant={generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight ? "default" : "outline"}
                    onClick={() => setPackageDetailsDialogOpen(true)}
                    className="w-full justify-start"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight
                      ? `${generalForm.packageWeight} lbs • ${generalForm.packageLength}" × ${generalForm.packageWidth}" × ${generalForm.packageHeight}"`
                      : "Enter weight & size"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-muted-foreground/30 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Facebook to refresh shipping policies & payout options.
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("facebook")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Facebook
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("facebook")}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button className="gap-2" onClick={() => handleListOnMarketplace("facebook")}>
                  List on Facebook
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-4 pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("Crosslist"))}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Package Details Dialog */}
      <Dialog open={packageDetailsDialogOpen} onOpenChange={setPackageDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Package Details</DialogTitle>
            <DialogDescription>
              Enter the package weight and dimensions. This information is required.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="package-weight" className="text-sm font-medium">
                Weight (lbs) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="package-weight"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={generalForm.packageWeight}
                onChange={(e) => handleGeneralChange("packageWeight", e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="package-length" className="text-sm font-medium">
                  Length (in) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="package-length"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={generalForm.packageLength}
                  onChange={(e) => handleGeneralChange("packageLength", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="package-width" className="text-sm font-medium">
                  Width (in) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="package-width"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={generalForm.packageWidth}
                  onChange={(e) => handleGeneralChange("packageWidth", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="package-height" className="text-sm font-medium">
                  Height (in) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="package-height"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={generalForm.packageHeight}
                  onChange={(e) => handleGeneralChange("packageHeight", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="package-notes" className="text-sm font-medium">
                Additional Notes (Optional)
              </Label>
              <Textarea
                id="package-notes"
                placeholder="Fragile, special handling instructions, etc."
                value={generalForm.packageDetails}
                onChange={(e) => handleGeneralChange("packageDetails", e.target.value)}
                className="mt-1.5 min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPackageDetailsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setPackageDetailsDialogOpen(false)}
              disabled={!generalForm.packageWeight || !generalForm.packageLength || !generalForm.packageWidth || !generalForm.packageHeight}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Color Picker Dialog */}
      <ColorPickerDialog
        open={colorPickerOpen}
        onOpenChange={setColorPickerOpen}
        currentColor={editingColorField === "color1" ? generalForm.color1 : editingColorField === "color2" ? generalForm.color2 : editingColorField === "ebay.color" ? ebayForm.color : ""}
        onSelectColor={handleColorSelect}
        fieldLabel={
          editingColorField === "color1" ? "Primary Color" : 
          editingColorField === "color2" ? "Secondary Color" :
          editingColorField === "ebay.color" ? "Color" : "Color"
        }
      />

      {/* Description Generator Dialog */}
      <DescriptionGenerator
        open={descriptionGeneratorOpen}
        onOpenChange={setDescriptionGeneratorOpen}
        onSelectDescription={(description) => {
          if (activeForm === "general") {
            handleGeneralChange("description", description);
          } else {
            handleMarketplaceChange(activeForm, "description", description);
          }
        }}
        title={activeForm === "general" ? generalForm.title : templateForms[activeForm]?.title || generalForm.title}
        brand={activeForm === "general" ? generalForm.brand : templateForms[activeForm]?.brand || generalForm.brand}
        category={activeForm === "general" ? generalForm.category : generalForm.category}
        condition={activeForm === "general" ? generalForm.condition : generalForm.condition}
        similarDescriptions={similarItems}
      />

      {/* Image Editor */}
      <ImageEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        imageSrc={imageToEdit.url}
        onSave={handleSaveEditedImage}
        fileName={`${imageToEdit.marketplace}-${imageToEdit.photoId || 'photo'}-edited.jpg`}
        allImages={
          imageToEdit.marketplace === 'general' 
            ? (templateForms.general?.photos || []).map(p => p.preview || p.imageUrl || p.url)
            : (templateForms[imageToEdit.marketplace]?.photos || []).map(p => p.preview || p.imageUrl || p.url)
        }
        onApplyToAll={handleApplyFiltersToAll}
        itemId={currentEditingItemId || `temp_${imageToEdit.marketplace}`}
      />

      {/* Sold Lookup Dialog */}
      <SoldLookupDialog
        open={soldDialogOpen}
        onOpenChange={setSoldDialogOpen}
        itemName={generalForm.title || ""}
        onEbaySearch={() => {
          setEbaySearchInitialQuery(generalForm.title || "");
          setSoldDialogOpen(false);
          setEbaySearchDialogOpen(true);
        }}
      />

      {/* eBay Search Dialog */}
      <EbaySearchDialog
        open={ebaySearchDialogOpen}
        onOpenChange={setEbaySearchDialogOpen}
        onSelectItem={handleEbayItemSelect}
        initialSearchQuery={ebaySearchInitialQuery}
      />
    </div>
  );
}

