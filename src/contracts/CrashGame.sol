// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title CrashGame
 * @dev Provably fair crash game contract for O'Rocket DEX
 * @notice Supports WOVER and USDT payments with configurable revenue distribution
 */
contract CrashGame is Ownable, ReentrancyGuard, Pausable {
    
    // ============ Structs ============
    
    struct Round {
        uint256 roundNumber;
        bytes32 seedHash;        // Hash of server seed (pre-committed)
        bytes32 serverSeed;      // Revealed after crash
        uint256 crashPoint;      // Multiplier * 100 (e.g., 250 = 2.50x)
        uint256 totalWagered;
        uint256 totalPayout;
        uint256 startTime;
        uint256 endTime;
        RoundStatus status;
    }
    
    struct Bet {
        address player;
        uint256 amount;
        uint256 autoCashoutAt;   // Multiplier * 100 (0 = manual)
        uint256 cashedOutAt;     // 0 if not cashed out
        bool isWover;            // true = WOVER, false = USDT
    }
    
    enum RoundStatus {
        Betting,
        Flying,
        Crashed,
        Payout
    }
    
    // ============ State Variables ============
    
    IERC20 public woverToken;
    IERC20 public usdtToken;
    
    address public treasuryWallet;
    address public factoryDeployerWallet;
    
    uint256 public currentRoundId;
    uint256 public minBet = 1 ether;           // 1 token
    uint256 public maxBet = 1000 ether;        // 1000 tokens
    uint256 public maxMultiplier = 10000;      // 100.00x
    uint256 public instantCrashProbability = 3; // 3% chance of 1.00x crash
    
    uint256 public prizePoolWover;
    uint256 public prizePoolUsdt;
    uint256 public pendingRevenueWover;
    uint256 public pendingRevenueUsdt;
    
    uint256 public prizePoolPercentage = 70;   // 70% to prize pool, 30% to platform
    uint256 public constant MIN_POOL_PERCENTAGE = 20;
    uint256 public constant MAX_POOL_PERCENTAGE = 80;
    
    uint256 public bettingDuration = 15 seconds;
    
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => Bet[]) public roundBets;
    mapping(uint256 => mapping(address => uint256)) public playerBetIndex;
    mapping(uint256 => mapping(address => bool)) public hasPlayerBet;
    
    // ============ Events ============
    
    event RoundStarted(uint256 indexed roundId, bytes32 seedHash, uint256 startTime);
    event BetPlaced(uint256 indexed roundId, address indexed player, uint256 amount, bool isWover, uint256 autoCashoutAt);
    event RoundFlying(uint256 indexed roundId);
    event PlayerCashedOut(uint256 indexed roundId, address indexed player, uint256 multiplier, uint256 payout);
    event RoundCrashed(uint256 indexed roundId, uint256 crashPoint, bytes32 serverSeed);
    event PayoutProcessed(uint256 indexed roundId, address indexed player, uint256 amount);
    event PrizePoolRefilled(address indexed token, uint256 amount);
    event RevenueDistributed(bool isWover, uint256 prizePoolAmount, uint256 platformAmount);
    event ConfigUpdated(string param, uint256 value);
    
    // ============ Modifiers ============
    
    modifier onlyDuringBetting() {
        require(rounds[currentRoundId].status == RoundStatus.Betting, "Not betting phase");
        _;
    }
    
    modifier onlyDuringFlight() {
        require(rounds[currentRoundId].status == RoundStatus.Flying, "Not flying phase");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(
        address _woverToken,
        address _usdtToken,
        address _treasuryWallet,
        address _factoryDeployerWallet
    ) Ownable(msg.sender) {
        woverToken = IERC20(_woverToken);
        usdtToken = IERC20(_usdtToken);
        treasuryWallet = _treasuryWallet;
        factoryDeployerWallet = _factoryDeployerWallet;
    }
    
    // ============ Game Flow Functions ============
    
    /**
     * @dev Start a new round with pre-committed seed hash
     * @param _seedHash Hash of the server seed for provably fair
     */
    function startRound(bytes32 _seedHash) external onlyOwner whenNotPaused {
        // End previous round if needed
        if (currentRoundId > 0 && rounds[currentRoundId].status != RoundStatus.Payout) {
            revert("Previous round not completed");
        }
        
        currentRoundId++;
        
        rounds[currentRoundId] = Round({
            roundNumber: currentRoundId,
            seedHash: _seedHash,
            serverSeed: bytes32(0),
            crashPoint: 0,
            totalWagered: 0,
            totalPayout: 0,
            startTime: block.timestamp,
            endTime: 0,
            status: RoundStatus.Betting
        });
        
        emit RoundStarted(currentRoundId, _seedHash, block.timestamp);
    }
    
    /**
     * @dev Place a bet during betting phase
     * @param _amount Amount to bet
     * @param _isWover true for WOVER, false for USDT
     * @param _autoCashoutAt Auto cashout multiplier * 100 (0 for manual)
     */
    function placeBet(
        uint256 _amount,
        bool _isWover,
        uint256 _autoCashoutAt
    ) external nonReentrant onlyDuringBetting whenNotPaused {
        require(_amount >= minBet && _amount <= maxBet, "Invalid bet amount");
        require(!hasPlayerBet[currentRoundId][msg.sender], "Already bet this round");
        require(_autoCashoutAt == 0 || (_autoCashoutAt >= 101 && _autoCashoutAt <= maxMultiplier), "Invalid auto cashout");
        
        IERC20 token = _isWover ? woverToken : usdtToken;
        require(token.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        
        Bet memory newBet = Bet({
            player: msg.sender,
            amount: _amount,
            autoCashoutAt: _autoCashoutAt,
            cashedOutAt: 0,
            isWover: _isWover
        });
        
        playerBetIndex[currentRoundId][msg.sender] = roundBets[currentRoundId].length;
        hasPlayerBet[currentRoundId][msg.sender] = true;
        roundBets[currentRoundId].push(newBet);
        
        rounds[currentRoundId].totalWagered += _amount;
        
        // Add to pending revenue (will be distributed based on outcome)
        if (_isWover) {
            pendingRevenueWover += _amount;
        } else {
            pendingRevenueUsdt += _amount;
        }
        
        emit BetPlaced(currentRoundId, msg.sender, _amount, _isWover, _autoCashoutAt);
    }
    
    /**
     * @dev Start flying phase (end betting)
     */
    function startFlying() external onlyOwner onlyDuringBetting {
        require(block.timestamp >= rounds[currentRoundId].startTime + bettingDuration, "Betting period not over");
        rounds[currentRoundId].status = RoundStatus.Flying;
        emit RoundFlying(currentRoundId);
    }
    
    /**
     * @dev Player cashes out during flight
     * @param _currentMultiplier Current multiplier * 100
     */
    function cashout(uint256 _currentMultiplier) external nonReentrant onlyDuringFlight {
        require(hasPlayerBet[currentRoundId][msg.sender], "No bet placed");
        
        uint256 betIndex = playerBetIndex[currentRoundId][msg.sender];
        Bet storage bet = roundBets[currentRoundId][betIndex];
        
        require(bet.cashedOutAt == 0, "Already cashed out");
        require(_currentMultiplier >= 100, "Invalid multiplier");
        
        bet.cashedOutAt = _currentMultiplier;
        
        uint256 payout = (bet.amount * _currentMultiplier) / 100;
        
        // Payout from prize pool
        IERC20 token = bet.isWover ? woverToken : usdtToken;
        
        if (bet.isWover) {
            require(prizePoolWover >= payout, "Insufficient prize pool");
            prizePoolWover -= payout;
        } else {
            require(prizePoolUsdt >= payout, "Insufficient prize pool");
            prizePoolUsdt -= payout;
        }
        
        rounds[currentRoundId].totalPayout += payout;
        
        require(token.transfer(msg.sender, payout), "Payout transfer failed");
        
        emit PlayerCashedOut(currentRoundId, msg.sender, _currentMultiplier, payout);
    }
    
    /**
     * @dev End round with crash - reveals server seed
     * @param _serverSeed The revealed server seed
     * @param _crashPoint The crash point multiplier * 100
     */
    function crashRound(bytes32 _serverSeed, uint256 _crashPoint) external onlyOwner onlyDuringFlight {
        // Verify provably fair
        require(keccak256(abi.encodePacked(_serverSeed)) == rounds[currentRoundId].seedHash, "Invalid seed");
        require(_crashPoint >= 100, "Crash point must be >= 1.00x");
        
        Round storage round = rounds[currentRoundId];
        round.serverSeed = _serverSeed;
        round.crashPoint = _crashPoint;
        round.endTime = block.timestamp;
        round.status = RoundStatus.Crashed;
        
        // Process auto-cashouts and mark losers
        _processAutoCashouts(_crashPoint);
        
        emit RoundCrashed(currentRoundId, _crashPoint, _serverSeed);
        
        // Move to payout
        round.status = RoundStatus.Payout;
    }
    
    /**
     * @dev Process auto cashouts at crash point
     */
    function _processAutoCashouts(uint256 _crashPoint) internal {
        Bet[] storage bets = roundBets[currentRoundId];
        
        for (uint256 i = 0; i < bets.length; i++) {
            Bet storage bet = bets[i];
            
            // Skip already cashed out
            if (bet.cashedOutAt > 0) continue;
            
            // Check auto cashout
            if (bet.autoCashoutAt > 0 && bet.autoCashoutAt <= _crashPoint) {
                bet.cashedOutAt = bet.autoCashoutAt;
                
                uint256 payout = (bet.amount * bet.autoCashoutAt) / 100;
                
                IERC20 token = bet.isWover ? woverToken : usdtToken;
                
                if (bet.isWover && prizePoolWover >= payout) {
                    prizePoolWover -= payout;
                    token.transfer(bet.player, payout);
                    rounds[currentRoundId].totalPayout += payout;
                    emit PayoutProcessed(currentRoundId, bet.player, payout);
                } else if (!bet.isWover && prizePoolUsdt >= payout) {
                    prizePoolUsdt -= payout;
                    token.transfer(bet.player, payout);
                    rounds[currentRoundId].totalPayout += payout;
                    emit PayoutProcessed(currentRoundId, bet.player, payout);
                }
            }
            // Players who didn't cash out lose their bet (already in pending revenue)
        }
    }
    
    // ============ Revenue & Pool Management ============
    
    /**
     * @dev Refill prize pool
     */
    function refillPrizePool(uint256 _amount, bool _isWover) external onlyOwner {
        IERC20 token = _isWover ? woverToken : usdtToken;
        require(token.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        
        if (_isWover) {
            prizePoolWover += _amount;
        } else {
            prizePoolUsdt += _amount;
        }
        
        emit PrizePoolRefilled(address(token), _amount);
    }
    
    /**
     * @dev Distribute WOVER revenue
     */
    function distributeWoverRevenue() external onlyOwner {
        require(pendingRevenueWover > 0, "No pending WOVER revenue");
        
        uint256 prizeAmount = (pendingRevenueWover * prizePoolPercentage) / 100;
        uint256 platformAmount = pendingRevenueWover - prizeAmount;
        
        prizePoolWover += prizeAmount;
        
        require(woverToken.transfer(treasuryWallet, platformAmount), "Platform transfer failed");
        
        emit RevenueDistributed(true, prizeAmount, platformAmount);
        
        pendingRevenueWover = 0;
    }
    
    /**
     * @dev Distribute USDT revenue - 100% to factory deployer
     */
    function distributeUsdtRevenue() external onlyOwner {
        require(pendingRevenueUsdt > 0, "No pending USDT revenue");
        
        uint256 amount = pendingRevenueUsdt;
        
        require(usdtToken.transfer(factoryDeployerWallet, amount), "Transfer failed");
        
        emit RevenueDistributed(false, 0, amount);
        
        pendingRevenueUsdt = 0;
    }
    
    // ============ Admin Functions ============
    
    function setPrizePoolPercentage(uint256 _percentage) external onlyOwner {
        require(_percentage >= MIN_POOL_PERCENTAGE && _percentage <= MAX_POOL_PERCENTAGE, "Invalid percentage");
        prizePoolPercentage = _percentage;
        emit ConfigUpdated("prizePoolPercentage", _percentage);
    }
    
    function setMinBet(uint256 _minBet) external onlyOwner {
        minBet = _minBet;
        emit ConfigUpdated("minBet", _minBet);
    }
    
    function setMaxBet(uint256 _maxBet) external onlyOwner {
        maxBet = _maxBet;
        emit ConfigUpdated("maxBet", _maxBet);
    }
    
    function setMaxMultiplier(uint256 _maxMultiplier) external onlyOwner {
        maxMultiplier = _maxMultiplier;
        emit ConfigUpdated("maxMultiplier", _maxMultiplier);
    }
    
    function setBettingDuration(uint256 _duration) external onlyOwner {
        bettingDuration = _duration;
        emit ConfigUpdated("bettingDuration", _duration);
    }
    
    function setTreasuryWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0), "Invalid address");
        treasuryWallet = _wallet;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ View Functions ============
    
    function getCurrentRound() external view returns (Round memory) {
        return rounds[currentRoundId];
    }
    
    function getRoundBets(uint256 _roundId) external view returns (Bet[] memory) {
        return roundBets[_roundId];
    }
    
    function getPlayerBet(uint256 _roundId, address _player) external view returns (Bet memory) {
        require(hasPlayerBet[_roundId][_player], "No bet found");
        return roundBets[_roundId][playerBetIndex[_roundId][_player]];
    }
    
    function getPrizePoolBalance() external view returns (uint256 wover, uint256 usdt) {
        return (prizePoolWover, prizePoolUsdt);
    }
    
    function getPendingRevenue() external view returns (uint256 wover, uint256 usdt) {
        return (pendingRevenueWover, pendingRevenueUsdt);
    }
    
    /**
     * @dev Verify a past round's fairness
     */
    function verifyRound(uint256 _roundId, bytes32 _serverSeed) external view returns (bool) {
        return keccak256(abi.encodePacked(_serverSeed)) == rounds[_roundId].seedHash;
    }
}
